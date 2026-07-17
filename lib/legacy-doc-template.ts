import type { MatterFile } from "./matter";

type LegacyMergeValue = string | string[];

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getLastName(fullName: string): string {
  const parts = clean(fullName).split(" ").filter(Boolean);
  return parts.at(-1) ?? "";
}

function formatInputDateLong(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean(value);

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return clean(value);

  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function encodeFixedWidth(value: string, byteLength: number, encoding: BufferEncoding): Buffer {
  if (encoding === "utf16le") {
    const unitLength = byteLength / 2;
    const fixed = value.length > unitLength ? value.slice(0, unitLength) : value.padEnd(unitLength, " ");
    return Buffer.from(fixed, "utf16le");
  }

  const output = Buffer.alloc(byteLength, 0x20);
  Buffer.from(value, encoding).copy(output, 0, 0, byteLength);
  return output;
}

function replaceNeedle(buffer: Buffer, needle: Buffer, value: string, encoding: BufferEncoding): number {
  let replaced = 0;
  let offset = buffer.indexOf(needle);
  while (offset !== -1) {
    encodeFixedWidth(value, needle.length, encoding).copy(buffer, offset);
    replaced += 1;
    offset = buffer.indexOf(needle, offset + needle.length);
  }

  return replaced;
}

function replaceLegacyPlaceholder(
  buffer: Buffer,
  placeholder: string,
  value: LegacyMergeValue,
): number {
  const values = Array.isArray(value) ? value : [value];
  let replaced = 0;

  for (const encoding of ["utf16le", "latin1"] as const) {
    const needle = Buffer.from(placeholder, encoding);
    let offset = buffer.indexOf(needle);
    let occurrence = 0;

    while (offset !== -1) {
      const replacement = values[Math.min(occurrence, values.length - 1)] ?? "";
      encodeFixedWidth(replacement, needle.length, encoding).copy(buffer, offset);
      replaced += 1;
      occurrence += 1;
      offset = buffer.indexOf(needle, offset + needle.length);
    }
  }

  return replaced;
}

function encodeMixedLegacyText(
  value: string,
  unicodeUnitLength: number,
  latinUnitLength: number,
): Buffer {
  const unicodeText = value.slice(0, unicodeUnitLength).padEnd(unicodeUnitLength, " ");
  const latinText = value.slice(unicodeUnitLength).slice(0, latinUnitLength).padEnd(latinUnitLength, " ");
  return Buffer.concat([
    Buffer.from(unicodeText, "utf16le"),
    Buffer.from(latinText, "latin1"),
  ]);
}

function replaceMixedLegacyPlaceholder(buffer: Buffer, value: string): number {
  const unicodePrefix = "{{Applica";
  const latinSuffix = "nt_lastname_bold_captals}}";
  const needle = Buffer.concat([
    Buffer.from(unicodePrefix, "utf16le"),
    Buffer.from(latinSuffix, "latin1"),
  ]);
  let replaced = 0;
  let offset = buffer.indexOf(needle);

  while (offset !== -1) {
    encodeMixedLegacyText(value, unicodePrefix.length, latinSuffix.length).copy(buffer, offset);
    replaced += 1;
    offset = buffer.indexOf(needle, offset + needle.length);
  }

  return replaced;
}

export type LegacyDocMergeReport = {
  replacedPlaceholders: number;
  missingPlaceholders: string[];
};

export function buildLegacyDocMergeFields(matter: MatterFile): Record<string, LegacyMergeValue> {
  const applicantName = clean(matter.intake.applicant.fullName || matter.clientName);
  const respondentName = clean(matter.intake.respondent.fullName);
  const applicantNameUpper = applicantName.toLocaleUpperCase("en-NZ");
  const respondentNameUpper = respondentName.toLocaleUpperCase("en-NZ");
  const applicantLastName = getLastName(applicantName);
  const respondentLastName = getLastName(respondentName);
  const applicantLastNameUpper = applicantLastName.toLocaleUpperCase("en-NZ");
  const respondentLastNameUpper = respondentLastName.toLocaleUpperCase("en-NZ");
  const applicantLastNameLower = applicantLastName.toLocaleLowerCase("en-NZ");
  const respondentLastNameLower = respondentLastName.toLocaleLowerCase("en-NZ");
  const applicantAddress = matter.intake.applicant.isAddressConfidential
    ? "Confidential Address"
    : clean(matter.intake.applicant.homeAddress);
  const respondentAddress = clean(matter.intake.respondent.homeAddress);
  const today = formatToday();

  return {
    "{[Applciant_surname}}": applicantLastName,
    "{{Applciant_lastname}}": applicantLastName,
    "{{applicant_last_name}}": applicantLastName,
    "{{Applicant_last_name}}": applicantLastName,
    "{{Applicant_last_name_lowercase}}": applicantLastNameLower,
    "{{Respondent_last_name_lowercase}}": respondentLastNameLower,
    "{{applicant_fullname}}": applicantName,
    "{{Appli_lastname_bold_captals}}": applicantLastNameUpper,
    "{{Resp_lastname_bold_captals}}": respondentLastNameUpper,
    "{{App_lastname_bold_captals}}": applicantLastNameUpper,
    "{{Res_lastname_bold_captals}}": respondentLastNameUpper,
    "{{Applicant_lastname_bold_captals}}": applicantLastNameUpper,
    "__mixed_applicant_lastname_bold_captals": applicantLastNameUpper,
    "{{Respondent_lastname_bold_captals}}": respondentLastNameUpper,
    "{{Appliant_name_bold_capitals }}": applicantNameUpper,
    "{{Applicant_name_bold_captals}}": applicantNameUpper,
    "{{Respondnet_name_bold_capital}}": respondentNameUpper,
    "{{occupation}}": [
      clean(matter.intake.applicant.occupation),
      clean(matter.intake.respondent.occupation),
    ],
    "{{dd/month/yyyy}}": formatInputDateLong(matter.intake.applicant.dateOfBirth),
    "{{applicants_address}}": applicantAddress,
    "{{respondent_address))": respondentAddress,
    "{{applicant_phone_number}}": clean(matter.intake.applicant.mobilePhone),
    "{{date_format_dd/mm/yyyy}}": today,
    "{{date_format-dd/mm/yyyy}}": today,
  };
}

export function mergeLegacyDocTemplate(
  template: ArrayBuffer,
  fields: Record<string, LegacyMergeValue>,
): { buffer: ArrayBuffer; report: LegacyDocMergeReport } {
  const output = Buffer.from(template);
  const missingPlaceholders: string[] = [];
  let replacedPlaceholders = 0;

  for (const [placeholder, value] of Object.entries(fields)) {
    if (placeholder === "__mixed_applicant_lastname_bold_captals") {
      const replaced = replaceMixedLegacyPlaceholder(output, Array.isArray(value) ? value[0] ?? "" : value);
      replacedPlaceholders += replaced;
      if (replaced === 0) {
        missingPlaceholders.push(placeholder);
      }
      continue;
    }

    const replaced = replaceLegacyPlaceholder(output, placeholder, value);
    replacedPlaceholders += replaced;
    if (replaced === 0) {
      missingPlaceholders.push(placeholder);
    }
  }

  // Clean up any empty legacy Word form-field remnants without changing layout.
  replacedPlaceholders += replaceNeedle(output, Buffer.from("FORMTEXT", "utf16le"), "", "utf16le");
  replacedPlaceholders += replaceNeedle(output, Buffer.from("FORMTEXT", "latin1"), "", "latin1");

  return {
    buffer: output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer,
    report: { replacedPlaceholders, missingPlaceholders },
  };
}
