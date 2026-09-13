import { extractPlaceholders } from "../lib/template-scanner.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const splitRunText = [
  "Applicant age: ",
  "{{applicant_ag",
  "e}}",
].join("");

const placeholders = extractPlaceholders(splitRunText);

assert(placeholders.length === 1, `Expected one placeholder, found ${placeholders.length}.`);
assert(placeholders[0].raw === "{{applicant_age}}", `Unexpected placeholder: ${placeholders[0].raw}`);
assert(placeholders[0].status === "known", `Expected known placeholder, found ${placeholders[0].status}.`);

const malformed = extractPlaceholders("Bad field {{applicant_age");
assert(malformed.some((placeholder) => placeholder.status === "malformed"), "Expected malformed placeholder to be reported.");

console.log("Template scanner verification passed.");
