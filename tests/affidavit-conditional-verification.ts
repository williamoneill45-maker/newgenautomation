import assert from "node:assert/strict";

import { emptyOrdersSought, proceedingsTypeFromOrders, type NoticeType, type OrdersSought } from "../lib/application-orders.ts";
import { demoMatter } from "../lib/demo-data.ts";
import type { MatterFile } from "../lib/matter.ts";
import {
  buildAffidavitConditionalBlocks,
  buildAffidavitMergeFields,
  validateAffidavitApplicationSelection,
} from "../lib/standard-affidavit.ts";
import { extractPlaceholders } from "../lib/template-scanner.ts";

type Case = {
  name: string;
  noticeType: Exclude<NoticeType, "">;
  ordersSought: Partial<OrdersSought>;
  childCount: number;
  expected: Partial<Record<string, boolean>>;
  grammar?: Partial<Record<string, string>>;
  validation?: string | null;
};

function matterFor(input: Pick<Case, "noticeType" | "ordersSought" | "childCount">): MatterFile {
  const matter = structuredClone(demoMatter);
  const ordersSought = { ...emptyOrdersSought, ...input.ordersSought };
  matter.intake.noticeType = input.noticeType;
  matter.intake.ordersSought = ordersSought;
  matter.intake.proceedingsType = proceedingsTypeFromOrders(ordersSought);
  matter.intake.children = matter.intake.children.slice(0, input.childCount);
  matter.intake.selectedApplications = [];
  return matter;
}

const cases: Case[] = [
  {
    name: "Protection only - Without Notice - no children",
    noticeType: "without_notice",
    ordersSought: { protection: true },
    childCount: 0,
    expected: {
      protection_facts_block: true,
      protection_without_notice_block: true,
      parenting_block: false,
      tenancy_facts_block: false,
      ancillary_furniture_facts_block: false,
      orders_sought_without_notice_clause: true,
    },
  },
  {
    name: "Protection only - Without Notice - one child",
    noticeType: "without_notice",
    ordersSought: { protection: true },
    childCount: 1,
    expected: { has_children: true },
    grammar: { child_or_children: "child", child_has_or_have: "has", child_is_or_are: "is", child_they: "they" },
  },
  {
    name: "Protection only - On Notice",
    noticeType: "on_notice",
    ordersSought: { protection: true },
    childCount: 0,
    expected: {
      protection_facts_block: true,
      protection_without_notice_block: false,
      orders_sought_without_notice_clause: false,
    },
  },
  {
    name: "Parenting - one child",
    noticeType: "on_notice",
    ordersSought: { parenting: true },
    childCount: 1,
    expected: { parenting_block: true, parenting_proposal_block: true },
    grammar: { child_or_children: "child", child_possessive: "child's" },
  },
  {
    name: "Parenting - multiple children",
    noticeType: "on_notice",
    ordersSought: { parenting: true },
    childCount: 2,
    expected: { parenting_block: true },
    grammar: { child_or_children: "children", child_possessive: "children's", child_has_or_have: "have" },
  },
  {
    name: "Protection + Parenting - Without Notice",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true },
    childCount: 1,
    expected: { protection_without_notice_block: true, parenting_block: true },
  },
  {
    name: "Protection + Tenancy - Without Notice - no children",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true },
    childCount: 0,
    expected: { tenancy_facts_block: true, tenancy_without_notice_block: true, has_children: false },
  },
  {
    name: "Protection + Tenancy - Without Notice - children",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true },
    childCount: 2,
    expected: { tenancy_facts_block: true, tenancy_without_notice_block: true, has_children: true },
  },
  {
    name: "Protection + Ancillary Furniture - Without Notice",
    noticeType: "without_notice",
    ordersSought: { protection: true, ancillaryFurniture: true },
    childCount: 0,
    expected: { ancillary_furniture_facts_block: true, ancillary_furniture_without_notice_block: true },
  },
  {
    name: "Protection + Tenancy + Ancillary Furniture - Without Notice",
    noticeType: "without_notice",
    ordersSought: { protection: true, tenancy: true, ancillaryFurniture: true },
    childCount: 0,
    expected: { tenancy_facts_block: true, ancillary_furniture_facts_block: true },
  },
  {
    name: "All applications - Without Notice - one child",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    childCount: 1,
    expected: { protection_without_notice_block: true, tenancy_without_notice_block: true, ancillary_furniture_without_notice_block: true, parenting_block: true },
    grammar: { child_or_children: "child", child_is_or_are: "is" },
  },
  {
    name: "All applications - Without Notice - multiple children",
    noticeType: "without_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    childCount: 2,
    expected: { protection_without_notice_block: true, tenancy_without_notice_block: true, ancillary_furniture_without_notice_block: true, parenting_block: true },
    grammar: { child_or_children: "children", child_is_or_are: "are" },
  },
  {
    name: "All applications - On Notice - multiple children",
    noticeType: "on_notice",
    ordersSought: { protection: true, parenting: true, tenancy: true, ancillaryFurniture: true },
    childCount: 2,
    expected: {
      protection_without_notice_block: false,
      tenancy_without_notice_block: false,
      ancillary_furniture_without_notice_block: false,
      orders_sought_without_notice_clause: false,
      parenting_block: true,
    },
  },
  {
    name: "Parenting validates children",
    noticeType: "on_notice",
    ordersSought: { parenting: true },
    childCount: 0,
    expected: { parenting_block: true },
    validation: "At least one child must be added before generating a Parenting Order affidavit.",
  },
];

for (const testCase of cases) {
  const matter = matterFor(testCase);
  const blocks = buildAffidavitConditionalBlocks(matter);
  const fields = buildAffidavitMergeFields(matter);

  for (const [key, value] of Object.entries(testCase.expected)) {
    assert.equal(blocks[key], value, `${testCase.name} ${key}`);
  }
  for (const [key, value] of Object.entries(testCase.grammar ?? {})) {
    assert.equal(fields[key], value, `${testCase.name} ${key}`);
  }
  if (testCase.validation !== undefined) {
    assert.equal(validateAffidavitApplicationSelection(matter), testCase.validation);
  }

  console.log(`${testCase.name}: ok`);
}

const markerScan = extractPlaceholders("{{#parenting_block}}Approved wording{{/parenting_block}} {{child_or_children}}");
assert.equal(markerScan.find((placeholder) => placeholder.key === "#parenting_block")?.status, "known");
assert.equal(markerScan.find((placeholder) => placeholder.key === "/parenting_block")?.status, "known");
assert.equal(markerScan.find((placeholder) => placeholder.key === "child_or_children")?.status, "known");
console.log("Template marker scan: ok");
