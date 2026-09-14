import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import JSZip from "jszip";

import { buildTemplateMergeFields } from "../lib/document-automation.ts";
import { mergeDocxTemplate } from "../lib/docx-template.ts";
import { readDocxVisibleText } from "../lib/template-scanner.ts";
import { demoMatter } from "../lib/demo-data.ts";
import {
  buildAffidavitDocxMergeOptions,
  buildAffidavitMergeFields,
  buildStandardAffidavitContent,
} from "../lib/standard-affidavit.ts";

const source = await readFile("templates/Domestic Violence Affidavit.docx");
const zip = await JSZip.loadAsync(source);
const documentXml = await zip.file("word/document.xml")?.async("string");
assert.ok(documentXml, "Affidavit template document.xml is missing");

zip.file(
  "word/document.xml",
  documentXml
    .replace(
      "(Family Violence Act 2018 Sections 60 and 75)",
      "{{relevant_legisaltion}}",
    ),
);

const template = await zip.generateAsync({ type: "arraybuffer" });
const matter = structuredClone(demoMatter);
matter.clientName = "Sarah Thompson";
matter.intake.applicant.fullName = "Sarah Thompson";
matter.intake.courtLocation = "Auckland Court";
matter.intake.noticeType = "without_notice";
matter.intake.ordersSought = {
  protection: true,
  parenting: true,
  tenancy: true,
  ancillaryFurniture: true,
};
matter.intake.proceedingsType = "both";
matter.intake.selectedApplications = [
  "Without Notice Application for Protection Order",
  "Without Notice Application for Parenting Order",
  "Without Notice Application for Tenancy Order",
  "Without Notice Application for Ancillary Furniture Order",
];

const affidavitContent = buildStandardAffidavitContent(matter);
const fields = {
  ...buildTemplateMergeFields(matter, "domestic_violence_affidavit"),
  Applicant_Name: "SARAH THOMPSON",
  affidavit_application_title: affidavitContent.applicationTitle,
  relationship_start_blurb: affidavitContent.relationshipStartBlurb,
  relationship_end: affidavitContent.relationshipEnd,
  relationship_end_blurb: affidavitContent.relationshipEnd,
  ...buildAffidavitMergeFields(matter, affidavitContent),
};

const mergeOptions = buildAffidavitDocxMergeOptions(matter, affidavitContent);
const result = await mergeDocxTemplate(template, fields, {
  ...mergeOptions,
  literalTextReplacements: {
    ...mergeOptions.literalTextReplacements,
    "AFFIDAVIT OF {{applicant_name}} IN SUPPORT OF WITHOUT NOTICE APPLICATION FOR PROTECTION ORDER":
      "AFFIDAVIT OF {{applicant_name}} IN SUPPORT OF {{applications}}",
  },
});
const text = await readDocxVisibleText(result.buffer);

assert.match(text, /I TE KŌTI-A-WHĀNAU\s+KI TĀMAKI MAKAURAU/i);
assert.match(text, /IN THE FAMILY COURT\s+HELD AT AUCKLAND/i);
assert.doesNotMatch(text, /AUCKLAND\s*\|\s*TĀMAKI MAKAURAU/i);
assert.match(
  text,
  /AFFIDAVIT OF SARAH THOMPSON IN SUPPORT OF WITHOUT NOTICE APPLICATION FOR PROTECTION, PARENTING, TENANCY AND ANCILLARY FURNITURE ORDERS/,
);
assert.match(
  text,
  /Family Violence Act 2018, ss 60, 75, 121, 122, 127 and 128; Care of Children Act 2004, ss 48 and 49/,
);
assert.doesNotMatch(text, /\{\{(?:applications|relevant_legislation|relevant_legisaltion|court_location|court_location_maori)[^{}]*\}\}/);

console.log("Affidavit page 1 generated DOCX verification: ok");
