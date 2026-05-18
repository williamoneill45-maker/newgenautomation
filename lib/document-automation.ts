import type {
  DocumentType,
  MatterFile,
  PlaceholderKey,
  UploadedTemplate,
} from "./matter";

export type TemplatePlaceholder = {
  key: PlaceholderKey;
  description: string;
  requiredFor: DocumentType[];
};

export const informationSheetPlaceholders: TemplatePlaceholder[] = [
  {
    key: "APPLICANT_NAME",
    description: "Applicant full legal name.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "RESPONDENT_NAME",
    description: "Respondent full legal name.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "APPLICANT_ADDRESS",
    description: "Applicant home address unless marked confidential.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "RESPONDENT_ADDRESS",
    description: "Respondent home address.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "COURT_LOCATION",
    description: "Family Court location selected for filing.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "CHILD_1_NAME",
    description: "First child full name.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "CHILD_1_DOB",
    description: "First child date of birth.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "CHILD_1_AGE",
    description: "First child calculated age from date of birth.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "APPLICATION_TYPE_1",
    description: "First selected application type.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "APPLICATION_TYPE_2",
    description: "Second selected application type.",
    requiredFor: ["information_sheet"],
  },
  {
    key: "APPLICATION_TYPE_3",
    description: "Third selected application type.",
    requiredFor: ["information_sheet"],
  },
];

export type MergeFieldValue = string | number | boolean | null | undefined;

export type MergeFields = Partial<Record<PlaceholderKey, string>>;

export type RawMergeFields = Partial<Record<PlaceholderKey, MergeFieldValue>>;

export type DocumentGenerationInput = {
  matterId: string;
  documentType: DocumentType;
  template: UploadedTemplate | null;
  mergeFields: MergeFields;
};

export function toSafeMergeValue(value: MergeFieldValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function normalizeMergeFields(fields: RawMergeFields): MergeFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, toSafeMergeValue(value)]),
  ) as MergeFields;
}

export function calculateAge(dateOfBirth: string, asAt = new Date()): string {
  if (!dateOfBirth) {
    return "";
  }

  const dob = new Date(dateOfBirth);

  if (Number.isNaN(dob.getTime())) {
    return "";
  }

  let age = asAt.getFullYear() - dob.getFullYear();
  const monthDifference = asAt.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && asAt.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

export function formatDateForForms(date = new Date()): string {
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function buildMatterMergeFields(matter: MatterFile): MergeFields {
  const { intake } = matter;
  const firstChild = intake.children[0];
  const today = formatDateForForms();
  const applicantAddress = intake.applicant.isAddressConfidential
    ? "Confidential"
    : intake.applicant.homeAddress;
  const childAge = firstChild?.age || calculateAge(firstChild?.dateOfBirth ?? "");

  return normalizeMergeFields({
    APPLICANT_NAME: intake.applicant.fullName,
    APPLICANT_FIRST_NAME: getFirstName(intake.applicant.fullName),
    RESPONDENT_NAME: intake.respondent.fullName,
    APPLICANT_ADDRESS: applicantAddress,
    RESPONDENT_ADDRESS: intake.respondent.homeAddress,
    COURT_LOCATION: intake.courtLocation,
    CHILD_1_NAME: firstChild?.fullName,
    CHILD_1_DOB: firstChild?.dateOfBirth,
    CHILD_1_AGE: childAge,
    APPLICATION_TYPE_1: intake.selectedApplications[0],
    APPLICATION_TYPE_2: intake.selectedApplications[1],
    APPLICATION_TYPE_3: intake.selectedApplications[2],
    applicant_dob: intake.applicant.dateOfBirth,
    applicant_home_address: applicantAddress,
    applicant_occupation: intake.applicant.occupation,
    applicant_phone_number: intake.applicant.mobilePhone,
    child_1_dob: firstChild?.dateOfBirth,
    child_1_name: firstChild?.fullName,
    date_today: today,
    "date_today ": today,
    Date_today: today,
    todays_date: today,
    respondent_age: calculateAge(intake.respondent.dateOfBirth),
    respondent_dob: intake.respondent.dateOfBirth,
    respondent_home_address: intake.respondent.homeAddress,
    respondent_occupation: intake.respondent.occupation,
    respondent_work_address: intake.respondent.workAddress,
    respondents_relationship_to_children:
      firstChild?.respondentRelationshipToChild ?? "",
  });
}

export function buildInformationSheetMergeFields(matter: MatterFile): MergeFields {
  return buildMatterMergeFields(matter);
}

export function buildDocumentGenerationInput(
  matter: MatterFile,
  documentType: DocumentType,
  template: UploadedTemplate | null = null,
): DocumentGenerationInput {
  return {
    matterId: matter.id,
    documentType,
    template,
    mergeFields: buildMatterMergeFields(matter),
  };
}

export function formatDocxPlaceholder(key: PlaceholderKey): string {
  return `{{${key}}}`;
}
