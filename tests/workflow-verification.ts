import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { buildAdditionalChildLines } from "../lib/child-continuation.ts";
import { buildTemplateMergeFields } from "../lib/document-automation.ts";
import { mergeDocxTemplate } from "../lib/docx-template.ts";
import { claimIsOverdue, derivePayment } from "../lib/legal-aid-claims.ts";
import { createEmptyChild, createEmptyMatter, type MatterFile } from "../lib/matter.ts";
import { buildStandardAffidavitContent } from "../lib/standard-affidavit.ts";

const root = process.cwd();
const outputDir = path.join("/tmp", "newgen-document-qa");

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
  matter.intake.applicant.ethnicity = "Other";
  matter.intake.applicant.otherEthnicity = "Dutch";
  matter.intake.respondent.fullName = "MICHAEL ROBERTS";
  matter.intake.respondent.ethnicity = "Other";
  matter.intake.respondent.otherEthnicity = "Tokelauan";
  matter.intake.children = Array.from({ length: count }, (_, index) => ({
    ...createEmptyChild(matter.id, index + 1),
    id: `child-${index + 1}`,
    fullName: `CHILD NUMBER ${index + 1}`,
    dateOfBirth: `20${String(10 + index).padStart(2, "0")}-01-01`,
    gender: index % 2 ? "M" : "F",
    livingWithName: "SARAH THOMPSON",
    ethnicity: index === 0 ? "Other" : "New Zealand European",
    otherEthnicity: index === 0 ? "Japanese" : "",
  }));
  return matter;
}

async function visibleText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  return (xml ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

async function verifyChildGeneration(count: number) {
  const matter = matterWithChildren(count);
  const affidavit = buildStandardAffidavitContent(matter);
  const affidavitText = [...affidavit.childrenParagraphs, ...affidavit.parentingParagraphs].join(" ");
  for (const child of matter.intake.children) assert.ok(affidavitText.includes(child.fullName), `Affidavit omitted ${child.fullName} at count ${count}`);
  assert.equal(buildAdditionalChildLines(matter).length, Math.max(0, count - 3));

  for (const [templateName, documentType] of [
    ["Information Sheet Final 1.docx", "information_sheet"],
    ["Application for parenting order.docx", "parenting_order_application"],
  ] as const) {
    const source = await readFile(path.join(root, "templates", templateName));
    const fields = buildTemplateMergeFields(matter, documentType);
    const result = await mergeDocxTemplate(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer, fields, {
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
    for (const child of matter.intake.children) assert.ok(text.includes(child.fullName), `${templateName} omitted ${child.fullName} at count ${count}`);
    if (documentType === "parenting_order_application") {
      assert.equal(text.includes("ADDITIONAL CHILDREN AFFECTED BY THE APPLICATION"), false);
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

assert.deepEqual(derivePayment(1000, 0), { paidStatus: "Unpaid", outstandingAmount: 1000 });
assert.deepEqual(derivePayment(1000, 400), { paidStatus: "Part Paid", outstandingAmount: 600 });
assert.deepEqual(derivePayment(1000, 1000), { paidStatus: "Paid", outstandingAmount: 0 });
assert.equal(claimIsOverdue({ dateSent: "2026-06-01", outstandingAmount: 200, lifecycleStatus: "Sent" }, "2026-06-23"), true);
assert.equal(claimIsOverdue({ dateSent: "2026-06-20", outstandingAmount: 200, lifecycleStatus: "Sent" }, "2026-06-23"), false);
assert.equal(claimIsOverdue({ dateSent: "2026-06-01", outstandingAmount: 0, lifecycleStatus: "Paid" }, "2026-06-23"), false);

console.log(`Workflow verification passed. Eight-child DOCX fixtures: ${outputDir}`);
