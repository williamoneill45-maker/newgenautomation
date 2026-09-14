import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("app/api/generate-legal-aid/route.ts", "utf8");

for (const forbidden of [
  "flattenLegalAidForm",
  "fillVisibleLegalAidWidgets",
  ".flatten(",
  "catalog.delete",
  "AcroForm\"))",
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
assert.match(source, /pdfDoc\.save\(\{ updateFieldAppearances: false \}\)/);

console.log("Legal Aid generation preserves editable PDF form fields: ok");
