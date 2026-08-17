import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { buildAdditionalChildLines } from "../lib/child-continuation.ts";
import { buildTemplateMergeFields } from "../lib/document-automation.ts";
import { mergeDocxTemplate } from "../lib/docx-template.ts";
import {
  COURT_LETTER_DATE_PLACEHOLDER,
  buildCourtLetterDocxLiteralReplacements,
  buildCourtLetterDocxMergeFields,
} from "../lib/legacy-doc-template.ts";
import { claimIsOverdue, derivePayment } from "../lib/legal-aid-claims.ts";
import { createEmptyChild, createEmptyMatter, type MatterFile } from "../lib/matter.ts";
import { buildStandardAffidavitContent } from "../lib/standard-affidavit.ts";
import { standardDocxTemplates } from "../lib/template-catalog.ts";

const root = process.cwd();
const outputDir = path.join("/tmp", "newgen-document-qa");
const childNames = [
  "Ari Thompson",
  "Maia Thompson",
  "Luca Thompson",
  "Noah Thompson",
  "Isla Thompson",
  "Theo Thompson",
  "Ruby Thompson",
  "Leo Thompson",
];

function matterWithChildren(count: number): MatterFile {
  const matter = createEmptyMatter();
  matter.clientName = "SARAH THOMPSON";
  matter.legalAidNumber = "100100100";
  matter.intake.proceedingsType = "both";
  matter.intake.selectedApplications = [
    "Without Notice Application for Protection Order",
    "Without Notice Application for Parenting Order",
  ];
  matter.intake.courtLocation = "Auckland Court";
  matter.intake.applicant.fullName = "SARAH THOMPSON";
  matter.intake.applicant.dateOfBirth = "1988-04-14";
  matter.intake.applicant.homeAddress = "12 Kauri Street, Auckland";
  matter.intake.applicant.mobilePhone = "021 555 0101";
  matter.intake.applicant.occupation = "Primary school teacher";
  matter.intake.applicant.ethnicity = "Other";
  matter.intake.applicant.otherEthnicity = "Dutch";
  matter.intake.respondent.fullName = "MICHAEL ROBERTS";
  matter.intake.respondent.homeAddress = "42 Rimu Lane, Henderson, Auckland";
  matter.intake.respondent.occupation = "Builder";
  matter.intake.respondent.ethnicity = "Other";
  matter.intake.respondent.otherEthnicity = "Tokelauan";
  matter.intake.children = Array.from({ length: count }, (_, index) => ({
    ...createEmptyChild(matter.id, index + 1),
    id: `child-${index + 1}`,
    fullName: childNames[index] ?? `Child Number ${index + 1}`,
    dateOfBirth: `20${String(10 + index).padStart(2, "0")}-01-01`,
    gender: index % 2 ? "M" : "F",
    livingWithName: "SARAH THOMPSON",
    ethnicity: index === 0 ? "Other" : "New Zealand European",
    otherEthnicity: index === 0 ? "Japanese" : "",
  }));
  return matter;
}

function arrayBufferFrom(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function documentXml(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return await zip.file("word/document.xml")?.async("string") ?? "";
}

async function visibleText(buffer: ArrayBuffer): Promise<string> {
  const xml = await documentXml(buffer);
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

async function verifyChildGeneration(count: number) {
  const matter = matterWithChildren(count);
  const affidavit = buildStandardAffidavitContent(matter);
  const affidavitText = [...affidavit.childrenParagraphs, ...affidavit.parentingParagraphs].join(" ");
  for (const child of matter.intake.children) {
    assert.ok(affidavitText.includes(child.fullName.toLocaleUpperCase("en-NZ")), `Affidavit omitted ${child.fullName} at count ${count}`);
  }
  if (count > 0) {
    assert.ok(affidavitText.includes("(“Ari”)"), "Domestic Violence Affidavit should use title-case child nickname");
    assert.equal(affidavitText.includes("(“ARI”)"), false, "Domestic Violence Affidavit should not use uppercase child nickname");
  }
  assert.equal(buildAdditionalChildLines(matter).length, Math.max(0, count - 3));

  for (const [templateName, documentType] of [
    ["Information Sheet Final 1.docx", "information_sheet"],
    ["Application for parenting order.docx", "parenting_order_application"],
  ] as const) {
    const source = await readFile(path.join(root, "templates", templateName));
    const fields = buildTemplateMergeFields(matter, documentType);
    const result = await mergeDocxTemplate(arrayBufferFrom(source), fields, {
      ...(documentType === "parenting_order_application" ? {
        childCount: Math.min(count, 3),
        repeatChildParagraphsThrough: count,
      } : {}),
      ...(documentType === "information_sheet" && count > 3 ? {
        continuationSections: [{
          heading: "ADDITIONAL CHILDREN AFFECTED BY THE APPLICATION",
          lines: buildAdditionalChildLines(matter),
        }],
      } : {}),
    });
    const text = await visibleText(result.buffer);
    for (const child of matter.intake.children) assert.ok(text.includes(child.fullName.toLocaleUpperCase("en-NZ")), `${templateName} omitted ${child.fullName} at count ${count}`);
    if (documentType === "parenting_order_application") {
      assert.equal(text.includes("ADDITIONAL CHILDREN AFFECTED BY THE APPLICATION"), false);
      if (count > 0) {
        assert.ok(text.includes("(“Ari”)"), "Parenting Order should use title-case child nickname");
        assert.equal(text.includes("(“ARI”)"), false, "Parenting Order should not use uppercase child nickname");
      }
    }
    if (documentType === "information_sheet") {
      assert.ok(text.includes("Dutch"), "Information Sheet omitted applicant Other ethnicity text");
      assert.ok(text.includes("Tokelauan"), "Information Sheet omitted respondent Other ethnicity text");
      assert.ok(text.includes("Japanese"), "Information Sheet omitted child Other ethnicity text");
    }
    if (count === 8) {
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, `${documentType}-8-children.docx`), Buffer.from(result.buffer));
    }
  }
}

for (const count of [0, 1, 3, 4, 5, 6, 8]) await verifyChildGeneration(count);

async function verifyInformationSheetApplications() {
  const matter = matterWithChildren(1);
  const source = await readFile(path.join(root, "templates", "Information Sheet Final 1.docx"));
  for (const applicationLabel of [
    "Without Notice Application for Parenting Order",
    "Without Notice Application for Protection Order",
  ]) {
    const result = await mergeDocxTemplate(arrayBufferFrom(source), {
      ...buildTemplateMergeFields(matter, "information_sheet"),
      APPLICATION_TYPE_1: applicationLabel,
      APPLICATION_TYPE_2: "",
      APPLICATION_TYPE_3: "",
      application_type_1: applicationLabel,
      application_type_2: "",
      application_type_3: "",
    }, {
      childCount: 1,
      informationSheetApplicationCount: 1,
    });
    const text = await visibleText(result.buffer);
    assert.ok(text.includes(applicationLabel), `Information Sheet omitted ${applicationLabel}`);
    assert.equal(text.includes("APPLICATION_TYPE_2"), false, "Information Sheet left application slot 2 placeholder visible");
    assert.equal(/\b2\.\s*\b3\./.test(text), false, "Information Sheet left empty application slot 2 visible");
  }
}

async function verifyProtectionOrderShineFormatting() {
  const matter = matterWithChildren(1);
  const applicantName = matter.intake.applicant.fullName.toLocaleUpperCase("en-NZ");
  const source = await readFile(path.join(root, "templates", "Application for Protection Order.docx"));
  const result = await mergeDocxTemplate(arrayBufferFrom(source), buildTemplateMergeFields(matter, "protection_order_application"), {
    protectionOrderShineApplicantName: applicantName,
    literalTextReplacements: {
      "{{RESPONDENT_NAME}} - currently working with Shine.": "{{APPLICANT_NAME}} - currently working with Shine.",
    },
  });
  const xml = await documentXml(result.buffer);
  const paragraph = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g)?.find((candidate) =>
    candidate.includes("currently working with Shine."),
  ) ?? "";
  assert.ok(paragraph.includes(applicantName), "Protection Order Shine line should use applicant name");
  assert.match(paragraph, new RegExp(`<w:b\\/?>(?:<w:bCs\\/>)?[\\s\\S]*?${applicantName}`), "Protection Order applicant name should be bold in Shine line");
  const suffixXml = paragraph.slice(paragraph.indexOf(applicantName) + applicantName.length);
  assert.ok(suffixXml.includes(" - currently working with Shine."), "Protection Order Shine suffix should remain visible");
  assert.equal(/<w:b\/?>/.test(suffixXml), false, "Protection Order Shine suffix should remain plain text");
}

await verifyInformationSheetApplications();
await verifyProtectionOrderShineFormatting();

async function verifyCourtLetterBundleTemplates() {
  const sourceFiles = standardDocxTemplates.map((template) => template.sourceFileName);
  assert.ok(sourceFiles.includes("court-letters/Registrar List Submissions.docx"), "Registrar List Submissions should be included in the standard bundle");
  assert.ok(sourceFiles.includes("court-letters/Ltr to client enclosing sworn affidavit .docx"), "Client sworn affidavit letter should be included in the standard bundle");
  for (const sourceFile of sourceFiles.filter((fileName) => fileName.startsWith("court-letters/"))) {
    assert.ok(sourceFile.endsWith(".docx"), `${sourceFile} should use converted DOCX merge path`);
  }
}

async function verifyCourtLetterMerge() {
  const matter = matterWithChildren(1);
  matter.intake.courtLocation = "Auckland | Tāmaki Makaurau" as MatterFile["intake"]["courtLocation"];
  const applicantSurnameUpper = "THOMPSON";
  const respondentSurnameUpper = "ROBERTS";
  const baseFields = {
    ...buildTemplateMergeFields(matter, "police_information_request_email"),
    ...buildCourtLetterDocxMergeFields(matter),
  };
  const replacements = buildCourtLetterDocxLiteralReplacements(matter);
  for (const template of standardDocxTemplates.filter((definition) => definition.sourceFileName.startsWith("court-letters/"))) {
    const source = await readFile(path.join(root, "templates", template.sourceFileName));
    const isRegistrarList = template.id === "registrar_list_submissions";
    const fields = {
      ...baseFields,
      ...(isRegistrarList
        ? {
            Applicant_last_name_lowercase: applicantSurnameUpper,
            Respondent_last_name_lowercase: respondentSurnameUpper,
          }
        : {}),
    };
    const result = await mergeDocxTemplate(arrayBufferFrom(source), fields, {
      literalTextReplacements: replacements,
      legacyCourtLetterDate: COURT_LETTER_DATE_PLACEHOLDER,
      ...(isRegistrarList
        ? {
            removeRegistrarHearingDate: true,
            registrarListPartySurnames: {
              applicantSurname: applicantSurnameUpper,
              respondentSurname: respondentSurnameUpper,
            },
          }
        : {}),
    });
    const text = await visibleText(result.buffer);
    const xml = await documentXml(result.buffer);
    assert.equal(text.includes("FORMTEXT"), false, `${template.title} left FORMTEXT visible`);
    assert.equal(text.includes("{{"), false, `${template.title} left an opening placeholder visible`);
    assert.equal(text.includes("}}"), false, `${template.title} left a closing placeholder visible`);
    assert.equal(text.includes("Auckland |"), false, `${template.title} should use English-only court location`);
    assert.ok(text.includes(COURT_LETTER_DATE_PLACEHOLDER), `${template.title} should use placeholder letter date`);
    assert.equal(text.includes("17 August 2026"), false, `${template.title} should not use generated current date`);
    if (template.sourceFileName.endsWith("Police Email.docx")) {
      assert.ok(text.includes("SARAH THOMPSON"), "Police Email should include applicant name");
      assert.ok(text.includes("MICHAEL ROBERTS"), "Police Email should include respondent name");
      assert.ok(text.includes("14 April 1988"), "Police Email should include full applicant DOB");
      assert.equal(text.includes("RE: SARAH THOMPSON ,"), false, "Police Email RE line should not retain a trailing comma");
      assert.equal(text.includes("against:-"), false, "Police Email should not retain against:- punctuation");
    }
    if (isRegistrarList) {
      assert.ok(text.includes("Applicant: THOMPSON"), "Registrar List should uppercase applicant surname");
      assert.ok(text.includes("Respondent: ROBERTS"), "Registrar List should uppercase respondent surname");
      assert.equal(text.includes("DATE OF REGISTRAR"), false, "Registrar List should remove registrar hearing date line");
      const applicantParagraph = xml.match(/<w:p\b[\s\S]*?Applicant:[\s\S]*?<\/w:p>/)?.[0] ?? "";
      const respondentParagraph = xml.match(/<w:p\b[\s\S]*?Respondent:[\s\S]*?<\/w:p>/)?.[0] ?? "";
      assert.match(applicantParagraph, /<w:b\/?>[\s\S]*?THOMPSON/, "Registrar applicant surname should be bold");
      assert.match(respondentParagraph, /<w:b\/?>[\s\S]*?ROBERTS/, "Registrar respondent surname should be bold");
    }
  }
}

await verifyCourtLetterBundleTemplates();
await verifyCourtLetterMerge();

assert.deepEqual(derivePayment(1000, 0), { paidStatus: "Unpaid", outstandingAmount: 1000 });
assert.deepEqual(derivePayment(1000, 400), { paidStatus: "Part Paid", outstandingAmount: 600 });
assert.deepEqual(derivePayment(1000, 1000), { paidStatus: "Paid", outstandingAmount: 0 });
assert.equal(claimIsOverdue({ dateSent: "2026-06-01", outstandingAmount: 200, lifecycleStatus: "Sent" }, "2026-06-23"), true);
assert.equal(claimIsOverdue({ dateSent: "2026-06-20", outstandingAmount: 200, lifecycleStatus: "Sent" }, "2026-06-23"), false);
assert.equal(claimIsOverdue({ dateSent: "2026-06-01", outstandingAmount: 0, lifecycleStatus: "Paid" }, "2026-06-23"), false);

console.log(`Workflow verification passed. Eight-child DOCX fixtures: ${outputDir}`);
