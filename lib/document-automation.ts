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
  const secondChild = intake.children[1];
  const today = formatDateForForms();
  const applicantAddress = intake.applicant.isAddressConfidential
    ? "Confidential"
    : intake.applicant.homeAddress;
  const childAge = firstChild?.age || calculateAge(firstChild?.dateOfBirth ?? "");
  const secondChildAge =
    secondChild?.age || calculateAge(secondChild?.dateOfBirth ?? "");
  const applicantAge = calculateAge(intake.applicant.dateOfBirth);
  const respondentAge = calculateAge(intake.respondent.dateOfBirth);

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
    applicant_age: applicantAge,
    applicant_dob: intake.applicant.dateOfBirth,
    applicant_home_address: applicantAddress,
    applicant_name: intake.applicant.fullName,
    applicant_occupation: intake.applicant.occupation,
    applicant_phone_number: intake.applicant.mobilePhone,
    application_type_1: intake.selectedApplications[0],
    application_type_2: intake.selectedApplications[1],
    application_type_3: intake.selectedApplications[2],
    child_1_age: childAge,
    child_1_dob: firstChild?.dateOfBirth,
    child_1_gender: firstChild?.gender,
    child_1_living_with: firstChild?.livingWithName,
    child_1_name: firstChild?.fullName,
    child_1_relationship_to_applicant: firstChild?.applicantRelationshipToChild,
    child_1_relationship_to_respondent: firstChild?.respondentRelationshipToChild,
    child_2_age: secondChildAge,
    child_2_dob: secondChild?.dateOfBirth,
    child_2_gender: secondChild?.gender,
    child_2_living_with: secondChild?.livingWithName,
    child_2_name: secondChild?.fullName,
    child_2_relationship_to_applicant:
      secondChild?.applicantRelationshipToChild,
    child_2_relationship_to_respondent:
      secondChild?.respondentRelationshipToChild,
    court_location: intake.courtLocation,
    date_today: today,
    "date_today ": today,
    Date_today: today,
    existing_child_orders: intake.proceedings.existingOrdersRelatingToChildren,
    existing_orders_between_parties:
      intake.proceedings.existingOrdersBetweenParties,
    marriage_date: intake.relationship.marriageOrCivilUnionDate,
    previous_applications: intake.proceedings.previousApplications,
    relationship_end_date: intake.relationship.relationshipEndDate,
    relationship_start_date: intake.relationship.deFactoRelationshipStart,
    todays_date: today,
    respondent_age: respondentAge,
    respondent_dob: intake.respondent.dateOfBirth,
    respondent_home_address: intake.respondent.homeAddress,
    respondent_name: intake.respondent.fullName,
    respondent_occupation: intake.respondent.occupation,
    respondent_relationship_to_applicant:
      intake.respondent.relationshipToApplicant,
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
