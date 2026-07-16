import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

import { POST } from "../app/api/generate-billing-document/route.ts";
import { createStructuredBillingRecord, validateStructuredBillingInput, type StructuredBillingInput } from "../lib/billing-selection.ts";

const baseInput: StructuredBillingInput = {
  formType: "32B" as const,
  clientName: "WILLIAM O'NEILL",
  legalAidNumber: "100100100",
  matterName: "O'NEILL v DOE",
  invoiceNumber: "Billing-Approval-Travel",
  invoiceType: "interim",
  selectedWorkItemIds: ["32-judge-directions", "32-directions-conference"],
  detailsByItem: {
    "32-directions-conference": { date: "2026-07-16", court: "", startTime: "10:00", endTime: "11:00" },
  },
  travelTimeSelected: true,
  mileageSelected: true,
  travelCourt: "Auckland Court",
  parking: 0,
  officeDisbursements: 0,
};

assert.deepEqual(validateStructuredBillingInput(baseInput), []);
const noTravelInput = { ...baseInput, travelTimeSelected: false, travelCourt: "" };
assert.deepEqual(validateStructuredBillingInput(noTravelInput), []);
const noTravelRecord = createStructuredBillingRecord(noTravelInput);
assert.equal(noTravelRecord.draft.court, "");
assert.equal(noTravelRecord.draft.travel, undefined);

const record = createStructuredBillingRecord(baseInput);
assert.equal(record.draft.court, "Auckland Court");
assert.equal(record.draft.travel?.progressResultsWording, "Travel to Auckland Court, return.");

const response = await POST(new Request("http://localhost/api/generate-billing-document", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ record, reviewed: true, uploadToOneDrive: false, evidenceImages: [{ fileName: "direction.png", contentType: "image/png", label: "Court direction", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }] }),
}));
if (!response.ok) throw new Error(`Billing generator returned ${response.status}: ${await response.text()}`);

const outputDir = path.resolve(process.cwd(), "..", "..", "outputs", "billing-approval");
await mkdir(outputDir, { recursive: true });
const buffer = await response.arrayBuffer();
const outputPath = path.join(outputDir, "Corrected Billing Form 32B v2.docx");
await writeFile(outputPath, Buffer.from(buffer));

const zip = await JSZip.loadAsync(buffer);
const documentXml = await zip.file("word/document.xml")?.async("string") ?? "";
const documentText = documentXml.replace(/<[^>]+>/g, "");
assert.match(documentXml, /Travel to Auckland Court, return\./);
assert.match(documentText, /1\.20 per km \(as per policy\)\. There is no GST on mileage\./);
assert.match(documentXml, /w:name="InterimInvoice"[\s\S]*?>X<\/w:t>/);
assert.doesNotMatch(documentXml, /w:name="FinalInvoice"[\s\S]{0,200}?>X<\/w:t>/);
assert.match(documentXml, /w:name="DateCompleted"[\s\S]*?\d{2}\/\d{2}\/\d{4}<\/w:t>/);
assert.ok(zip.file("word/media/newgen-evidence-1.png"));
const judgeRow = [...documentXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
  .map(([row]) => row)
  .find((row) => row.includes("Complying with Judge")) ?? "";
assert.match(judgeRow, /<w:cantSplit\s*\/>/);
assert.doesNotMatch(judgeRow, /<w:trHeight\b/);
assert.doesNotMatch(judgeRow, />1<\/w:t>/);
assert.equal((judgeRow.match(/>190\.00<\/w:t>/g) ?? []).length, 2);

const form33Input: StructuredBillingInput = {
  ...baseInput,
  formType: "33A",
  invoiceNumber: "Billing-Approval-Travel-33A",
  selectedWorkItemIds: ["33-judge-directions", "33-judicial-conference"],
  detailsByItem: {
    "33-judicial-conference": { date: "2026-07-16", court: "", startTime: "10:00", endTime: "11:00" },
  },
  invoiceType: "final",
};
assert.deepEqual(validateStructuredBillingInput(form33Input), []);
const form33Record = createStructuredBillingRecord(form33Input);
assert.equal(form33Record.draft.travel?.progressResultsWording, "Travel to Auckland Court, return.");
const form33Response = await POST(new Request("http://localhost/api/generate-billing-document", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ record: form33Record, reviewed: true, uploadToOneDrive: false, evidenceImages: [{ fileName: "direction.png", contentType: "image/png", label: "Court direction", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }] }),
}));
if (!form33Response.ok) throw new Error(`Form 33A generator returned ${form33Response.status}: ${await form33Response.text()}`);
const form33Buffer = await form33Response.arrayBuffer();
const form33OutputPath = path.join(outputDir, "Corrected Billing Form 33A v2.docx");
await writeFile(form33OutputPath, Buffer.from(form33Buffer));
const form33Zip = await JSZip.loadAsync(form33Buffer);
const form33Xml = await form33Zip.file("word/document.xml")?.async("string") ?? "";
const form33Text = form33Xml.replace(/<[^>]+>/g, "");
const form33JudgeRow = [...form33Xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)]
  .map(([row]) => row)
  .find((row) => row.includes("Complying with Judge")) ?? "";
assert.match(form33Xml, /Travel to Auckland Court, return\./);
assert.match(form33Text, /1\.20 per km \(as per policy\)\. There is no GST on mileage\./);
assert.match(form33Xml, /w:name="FinalInvoice"[\s\S]*?>X<\/w:t>/);
assert.doesNotMatch(form33Xml, /w:name="InterimInvoice"[\s\S]{0,200}?>X<\/w:t>/);
assert.match(form33Xml, /w:name="DateCompleted"[\s\S]*?\d{2}\/\d{2}\/\d{4}<\/w:t>/);
assert.ok(form33Zip.file("word/media/newgen-evidence-1.png"));
assert.match(form33JudgeRow, /<w:cantSplit\s*\/>/);
assert.doesNotMatch(form33JudgeRow, /<w:trHeight\b/);
assert.doesNotMatch(form33JudgeRow, />1<\/w:t>/);
assert.equal((form33JudgeRow.match(/>190\.00<\/w:t>/g) ?? []).length, 2);

console.log(outputPath);
console.log(form33OutputPath);

