import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { emptyOrdersSought, proceedingsTypeFromOrders, type NoticeType, type OrdersSought } from "../lib/application-orders.ts";
import { buildTemplateMergeFields } from "../lib/document-automation.ts";
import { mergeDocxTemplate } from "../lib/docx-template.ts";
import { readDocxVisibleText } from "../lib/template-scanner.ts";
import { demoMatter } from "../lib/demo-data.ts";
import type { MatterFile } from "../lib/matter.ts";
import {
  buildAffidavitDocxMergeOptions,
  buildAffidavitMergeFields,
  buildStandardAffidavitContent,
  validateAffidavitApplicationSelection,
} from "../lib/standard-affidavit.ts";

type Case = {
  name: string;
  noticeType: Exclude<NoticeType, "">;
  ordersSought: Partial<OrdersSought>;
  childCount: number;
  furnitureItems?: string[];
  parentingSafetyReasons?: string[];
  expected: string[];
  absent: string[];
};

const source = await readFile("templates/Domestic Violence Affidavit.docx");
const template = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;

function matterFor(input: Case): MatterFile {
  const matter = structuredClone(demoMatter);
  const ordersSought = { ...emptyOrdersSought, ...input.ordersSought };
  matter.intake.applicant.fullName = "SARAH THOMPSON";
  matter.intake.applicant.homeAddress = "14 Example Street, Auckland 1010";
  matter.intake.respondent.fullName = "MICHAEL ROBERTS";
  matter.intake.courtLocation = "Auckland Court";
  matter.intake.noticeType = input.noticeType;
  matter.intake.ordersSought = ordersSought;
  matter.intake.proceedingsType = proceedingsTypeFromOrders(ordersSought);
  matter.intake.selectedApplications = [];
  matter.intake.children = matter.intake.children.slice(0, input.childCount);
  matter.intake.domesticViolenceNotes = {
    ...matter.intake.domesticViolenceNotes,
    dwellingAddress: "22 Shared Home Road, Auckland",
    ancillaryFurnitureItems: input.furnitureItems ?? ["Washing machine", "Dining table"],
    parentingSafetyReasons: input.parentingSafetyReasons ?? ["the child has been exposed to the Respondent's abuse described in this affidavit"],
    contactSupervisionReason: "",
  };
  return matter;
}

async function generateText(matter: MatterFile): Promise<string> {
  const validationError = validateAffidavitApplicationSelection(matter);
  assert.equal(validationError, null);
  const content = buildStandardAffidavitContent(matter);
  const fields = {
    ...buildTemplateMergeFields(matter, "domestic_violence_affidavit"),
    ...buildAffidavitMergeFields(matter, content),
  };
  const result = await mergeDocxTemplate(template, fields, buildAffidavitDocxMergeOptions(matter, content));
  assert.deepEqual(result.report.missingFields, []);
  return readDocxVisibleText(result.buffer);
}

const mockText = [
  "pre school and friends",
  "unable to control his anger",
  "mental health",
  "uncontrollable thoughts",
  "Protection Order, Tenancy and Ancillary Furniture against the Respondent",
  "Microwave",
  "Television",
];

const cases: Case[] = [
  {
    name: "Protection only - Without Notice - no children",
    noticeType: "without_notice",
    ordersSought: { protection: true },
    childCount: 0,
    expected: ["Facts in Support of Application for Protection Order Without Notice", "I may suffer further abuse."],
    absent: ["FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER", "MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT", "and the children of my family"],
  },
  {
    name: "Protection only - Without Notice - children",
    noticeType: "without_notice",
    ordersSought: { protection: true },
    childCount: 2,
    expected: ["and the children of my family", "The Respondent and I are the parents of the following children"],
    absent: ["FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER"],
  },
  {
    name: "Protection + Parenting - one child",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true },
    childCount: 1,
    expected: ["MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT", "the child's safety", "(a) the child has been exposed"],
    absent: ["the children's safety", "unable to control his anger"],
  },
  {
    name: "Protection + Parenting - multiple children",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true },
    childCount: 2,
    parentingSafetyReasons: ["the children have been exposed to the Respondent's abuse described in this affidavit"],
    expected: ["the children's safety", "(a) the children have been exposed"],
    absent: ["the child's safety", "mental health"],
  },
  {
    name: "Protection + Tenancy",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true },
    childCount: 1,
    expected: ["FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER", "I am applying for a Protection Order against the Respondent.", "22 Shared Home Road, Auckland"],
    absent: ["MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT"],
  },
  {
    name: "Protection + Tenancy - no children",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true },
    childCount: 0,
    expected: ["FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER WITHOUT NOTICE"],
    absent: ["best interests of our child", "best interests of the children", "or a child of my family"],
  },
  {
    name: "Protection + Tenancy + Ancillary Furniture",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true, ancillaryFurniture: true },
    childCount: 0,
    furnitureItems: ["Laptop", "Bed"],
    expected: ["FACTS IN SUPPORT OF APPLICATION FOR ANCILLARY FURNITURE ORDER", "(a) Laptop", "(b) Bed"],
    absent: ["MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT"],
  },
  {
    name: "All four orders - Without Notice",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    childCount: 2,
    furnitureItems: ["Washing machine", "Dining table"],
    parentingSafetyReasons: ["the children have been exposed to the Respondent's abuse described in this affidavit"],
    expected: [
      "WITHOUT NOTICE APPLICATION FOR PROTECTION, PARENTING, TENANCY AND ANCILLARY FURNITURE ORDERS",
      "Family Violence Act 2018, ss 60, 75, 121, 122, 127 and 128; Care of Children Act 2004, ss 48 and 49",
      "FACTS IN SUPPORT OF APPLICATION FOR FURNITURE ORDER WITHOUT NOTICE",
    ],
    absent: [],
  },
  {
    name: "All four orders - On Notice",
    noticeType: "on_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    childCount: 2,
    furnitureItems: ["Washing machine"],
    parentingSafetyReasons: ["the children have been exposed to the Respondent's abuse described in this affidavit"],
    expected: ["ON NOTICE APPLICATION FOR PROTECTION, PARENTING, TENANCY AND ANCILLARY FURNITURE ORDERS"],
    absent: [
      "Facts in Support of Application for Protection Order Without Notice",
      "FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER WITHOUT NOTICE",
      "FACTS IN SUPPORT OF APPLICATION FOR FURNITURE ORDER WITHOUT NOTICE",
      "without notice to the Respondent",
    ],
  },
];

for (const testCase of cases) {
  const text = await generateText(matterFor(testCase));
  assert.doesNotMatch(text, /\{\{[^{}]+\}\}/, `${testCase.name} unresolved placeholder`);
  assert.doesNotMatch(text, /AUCKLAND\s*\|\s*TĀMAKI MAKAURAU/i, `${testCase.name} combined court location`);
  assert.doesNotMatch(text, /\(i\)\s*\(a\)/i, `${testCase.name} double parenting safety marker`);
  assert.doesNotMatch(text, /grantingme/i, `${testCase.name} tenancy granting spacing`);
  assert.doesNotMatch(text, /Respondent\.I am also/i, `${testCase.name} tenancy sentence spacing`);
  for (const expected of testCase.expected) {
    assert.ok(text.includes(expected), `${testCase.name} missing ${expected}`);
  }
  for (const absent of [...testCase.absent, ...mockText]) {
    assert.equal(text.includes(absent), false, `${testCase.name} should not contain ${absent}`);
  }
  console.log(`${testCase.name}: ok`);
}

const noFurniture = matterFor({
  name: "Furniture validation",
  noticeType: "without_notice",
  ordersSought: { ancillaryFurniture: true },
  childCount: 0,
  furnitureItems: [],
  expected: [],
  absent: [],
});
assert.equal(
  validateAffidavitApplicationSelection(noFurniture),
  "At least one furniture or chattel item is required before generating an Ancillary Furniture Order affidavit.",
);
console.log("Furniture validation: ok");
