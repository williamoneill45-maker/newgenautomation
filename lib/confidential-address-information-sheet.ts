import { PDFCheckBox, PDFDocument, PDFTextField, StandardFonts } from "pdf-lib";

import { calculateAge } from "./document-automation.ts";
import type { MatterFile } from "./matter.ts";

function setText(form: ReturnType<PDFDocument["getForm"]>, name: string, value: string) {
  try { form.getTextField(name).setText(value); } catch { /* The supplied form controls the available field set. */ }
}

function setChecked(form: ReturnType<PDFDocument["getForm"]>, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name);
    checked ? field.check() : field.uncheck();
  } catch { /* Ignore fields omitted by a later court-issued revision. */ }
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export async function completeConfidentialAddressInformationSheet(
  source: ArrayBuffer,
  matter: MatterFile,
): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.load(source);
  const form = pdf.getForm();

  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) field.setText("");
    if (field instanceof PDFCheckBox) field.uncheck();
  }

  const applicant = matter.intake.applicant;
  const court = matter.intake.courtLocation.replace(/\s+Court$/i, "").trim();
  setText(form, "In the Family Court at", court);
  setText(form, "Confidential Address  Applicant Information Sheet", matter.intake.famNumber);
  const applications = matter.intake.proceedingsType === "both"
    ? "Protection Order; Parenting Order"
    : matter.intake.proceedingsType === "protection_order" ? "Protection Order" : "Parenting Order";
  setText(form, "FAM", applications);
  setText(form, "Full name", applicant.fullName);
  setText(form, "DOB ddmmyyyy", formatDate(applicant.dateOfBirth));
  setText(form, "Age", calculateAge(applicant.dateOfBirth));
  setText(form, "Gender", applicant.gender);
  setText(form, "Service address", "c/o Natalie Quirke, PO Box 25-977, St Heliers 1070");
  setText(form, "Mob", applicant.mobilePhone);
  setText(form, "Home address", applicant.homeAddress);
  setText(form, "Phone", applicant.mobilePhone);
  setText(form, "Work address", applicant.workAddress);
  setText(form, "Country of residence", "New Zealand");
  setText(form, "Email address Please check this box if you consent to receive official Court correspondence by email", applicant.emailAddress);
  setChecked(form, "undefined", Boolean(applicant.emailAddress));
  setText(form, "Occupationwhat you do", applicant.occupation);
  setChecked(form, "NZ European", applicant.ethnicity === "New Zealand European");
  const ethnicity = String(applicant.ethnicity).toLocaleLowerCase("en-NZ");
  setChecked(form, "toggle_3", ethnicity.includes("ori") && !ethnicity.includes("cook"));
  setChecked(form, "Samoan", applicant.ethnicity === "Samoan");
  setChecked(form, "toggle_5", ethnicity.includes("cook") && ethnicity.includes("ori"));
  setChecked(form, "Tongan", applicant.ethnicity === "Tongan");
  setChecked(form, "Niuean", applicant.ethnicity === "Niuean");
  setChecked(form, "Chinese", applicant.ethnicity === "Chinese");
  setChecked(form, "Indian", applicant.ethnicity === "Indian");
  setChecked(form, "Other please state", applicant.ethnicity === "Other");
  if (applicant.ethnicity === "Other") setText(form, "Other please state", applicant.otherEthnicity);
  setChecked(form, "undefined_2", true);
  const relationship = (matter.intake.children[0]?.applicantRelationshipToChild ?? "Parent").toLocaleLowerCase("en-NZ");
  const isParent = relationship === "parent" || relationship === "mother" || relationship === "father";
  setChecked(form, "undefined_4", isParent);
  setChecked(form, "undefined_5", relationship.includes("guardian"));
  setChecked(form, "undefined_6", !isParent && !relationship.includes("guardian"));
  setText(form, "Your relationship to the children Parent Legal guardian Other specify", isParent || relationship.includes("guardian") ? "" : relationship);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  form.flatten({ updateFieldAppearances: true });
  return (await pdf.save()).buffer as ArrayBuffer;
}
