import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PDFDocument, PDFName } from "pdf-lib";

import { POST } from "../app/api/generate-legal-aid/route.ts";

const source = await readFile("app/api/generate-legal-aid/route.ts", "utf8");

for (const forbidden of [
  "flattenLegalAidForm",
  "fillVisibleLegalAidWidgets",
  ".flatten(",
  "catalog.delete",
  "removeAnnot",
  "delete(field.ref",
  "drawRectangle",
  "drawText",
  "enableReadOnly",
  "readOnly",
]) {
  assert.equal(source.includes(forbidden), false, `Legal Aid generation must not use ${forbidden}`);
}

assert.match(source, /form\.getTextField\(fieldName\)/);
assert.match(source, /field\.setText\(/);
assert.match(source, /form\.getCheckBox\(fieldName\)/);
assert.match(source, /updateFieldAppearances\(font\)/);
assert.doesNotMatch(source, /updateFieldAppearances: false/);

const review = {
  title: "Ms",
  clientName: "Kelly Sullivan",
  dob: "01/02/1990",
  homeAddress: "1 Test Street, Auckland",
  lawyerPostalAddress: "PO Box 1, Auckland",
  mobilePhone: "021 000 000",
  email: "kelly@example.com",
  numberOfChildren: "2",
  courtLocation: "Auckland",
  proceedingsType: "Without Notice Application for Protection Order",
  protectionOrderWording: "Protection Order sought.",
  parentingOrderWording: "",
  abuseSummary: "Family violence summary.",
  dateToday: "14/09/2026",
};

const formData = new FormData();
formData.set("review", JSON.stringify(review));

const response = await POST(new Request("http://localhost/api/generate-legal-aid", {
  method: "POST",
  body: formData,
}));
assert.equal(response.status, 200);

const generated = await PDFDocument.load(await response.arrayBuffer(), { ignoreEncryption: true });
assert.ok(generated.catalog.get(PDFName.of("AcroForm")), "Generated PDF must retain /AcroForm.");

const form = generated.getForm();
const fieldNames = new Set(form.getFields().map((field) => field.getName()));
assert.ok(fieldNames.size > 0, "Generated PDF must retain form fields.");
for (const fieldName of ["Question 2", "Question 4", "Question 5", "Question 31", "Question 33"]) {
  assert.ok(fieldNames.has(fieldName), `Generated PDF is missing ${fieldName}`);
}
assert.equal(form.getTextField("Question 2").getText(), "Kelly Sullivan");
assert.equal(form.getTextField("Question 4").getText(), "01/02/1990");
assert.equal(form.getTextField("Question 5").getText(), "1 Test Street, Auckland");
assert.match(form.getTextField("Question 31").getText() ?? "", /Auckland/);
assert.match(form.getTextField("Question 33").getText() ?? "", /Protection Order sought/);

console.log("Legal Aid generation preserves editable PDF form fields: ok");
