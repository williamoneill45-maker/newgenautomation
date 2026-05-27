import type {
  Child,
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

export type MergeFieldTextValue = string | string[] | undefined;

export type MergeFields = Partial<Record<PlaceholderKey, string>> & Record<string, MergeFieldTextValue>;

export type RawMergeFields = Partial<Record<PlaceholderKey, MergeFieldValue>> &
  Record<string, MergeFieldValue>;

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

function formatInputDateForForms(value: string): string {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function getQuotedFirstName(fullName: string): string {
  const firstName = getFirstName(fullName);
  return firstName ? `"${firstName}"` : "";
}

function getEthnicity(ethnicity: string, otherEthnicity?: string): string {
  return ethnicity === "Other" && otherEthnicity?.trim() ? otherEthnicity.trim() : ethnicity;
}

function normalizeEthnicity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isEthnicity(value: string, expected: string): string {
  const normalizedValue = normalizeEthnicity(value);
  const expectedAliases: Record<string, string[]> = {
    "New Zealand European": ["new zealand european", "nz european", "european"],
    Maori: ["maori"],
    "Pacific Peoples": ["pacific peoples", "pacific", "pasifika"],
    Asian: ["asian"],
    "Middle Eastern / Latin American / African": [
      "middle eastern latin american african",
      "middle eastern latin american or african",
      "melaa",
    ],
    Other: ["other"],
  };

  return expectedAliases[expected]?.includes(normalizedValue) ? "☒" : "☐";
}

function joinPresent(values: Array<string | undefined>): string {
  return values.filter((value) => value?.trim()).join("\n");
}

function buildChildMergeFields(child: Child | undefined, index: 1 | 2 | 3 | 4): RawMergeFields {
  const prefix = `child_${index}`;
  const childAge = child?.age || calculateAge(child?.dateOfBirth ?? "");
  const childEthnicity = child ? getEthnicity(child.ethnicity, child.otherEthnicity) : "";
  const childName = child?.fullName ?? "";
  const nickname = getQuotedFirstName(childName);

  return {
    [`${prefix}_age`]: childAge,
    [`${prefix}_dob`]: formatInputDateForForms(child?.dateOfBirth ?? ""),
    [`${prefix}_ethnicity`]: childEthnicity,
    [`${prefix}_ethnicity_nz_european`]: isEthnicity(child?.ethnicity ?? "", "New Zealand European"),
    [`${prefix}_ethnicity_maori`]: isEthnicity(child?.ethnicity ?? "", "Maori"),
    [`${prefix}_ethnicity_pacific`]: isEthnicity(child?.ethnicity ?? "", "Pacific Peoples"),
    [`${prefix}_ethnicity_asian`]: isEthnicity(child?.ethnicity ?? "", "Asian"),
    [`${prefix}_ethnicity_melaa`]: isEthnicity(child?.ethnicity ?? "", "Middle Eastern / Latin American / African"),
    [`${prefix}_ethnicity_other`]: isEthnicity(child?.ethnicity ?? "", "Other"),
    [`${prefix}_gender`]: child?.gender,
    [`${prefix}_living_with`]: child?.livingWithName,
    [`${prefix}_name`]: childName,
    [`${prefix}_nickname`]: nickname,
    [`(“${prefix}_nickname”)`]: nickname,
    [`${prefix}_relationship_to_applicant`]: child?.applicantRelationshipToChild,
    [`${prefix}_relationship_to_respondent`]: child?.respondentRelationshipToChild,
  };
}

export function buildMatterMergeFields(matter: MatterFile): MergeFields {
  const { intake } = matter;
  const firstChild = intake.children[0];
  const secondChild = intake.children[1];
  const thirdChild = intake.children[2];
  const fourthChild = intake.children[3];
  const today = formatDateForForms();
  const applicantAddress = intake.applicant.isAddressConfidential
    ? "Confidential Address"
    : intake.applicant.homeAddress;
  const childAge = firstChild?.age || calculateAge(firstChild?.dateOfBirth ?? "");
  const applicantAge = calculateAge(intake.applicant.dateOfBirth);
  const respondentAge = calculateAge(intake.respondent.dateOfBirth);
  const otherApplicationDetails = intake.otherApplicationDetails?.trim() ?? "";
  const selectedApplications = intake.selectedApplications.map((application) =>
    application === "Other" && otherApplicationDetails
      ? otherApplicationDetails
      : application,
  );
  const applicantEthnicity = getEthnicity(intake.applicant.ethnicity, intake.applicant.otherEthnicity);
  const respondentEthnicity = getEthnicity(intake.respondent.ethnicity, intake.respondent.otherEthnicity);

  return normalizeMergeFields({
    APPLICANT_NAME: intake.applicant.fullName,
    APPLICANT_FIRST_NAME: getFirstName(intake.applicant.fullName),
    RESPONDENT_NAME: intake.respondent.fullName,
    APPLICANT_ADDRESS: applicantAddress,
    RESPONDENT_ADDRESS: intake.respondent.homeAddress,
    COURT_LOCATION: intake.courtLocation,
    CHILD_1_NAME: firstChild?.fullName,
    CHILD_1_DOB: formatInputDateForForms(firstChild?.dateOfBirth ?? ""),
    CHILD_1_AGE: childAge,
    APPLICATION_TYPE_1: selectedApplications[0],
    APPLICATION_TYPE_2: selectedApplications[1],
    APPLICATION_TYPE_3: selectedApplications[2],
    applicant_age: applicantAge,
    applicant_dob: formatInputDateForForms(intake.applicant.dateOfBirth),
    applicant_home_address: applicantAddress,
    applicant_name: intake.applicant.fullName,
    applicant_occupation: intake.applicant.occupation,
    applicant_phone_number: intake.applicant.mobilePhone,
    applicant_phone: intake.applicant.mobilePhone,
    applicant_email: intake.applicant.emailAddress,
    applicant_ethnicity: applicantEthnicity,
    applicant_ethnicity_nz_european: isEthnicity(intake.applicant.ethnicity, "New Zealand European"),
    applicant_ethnicity_maori: isEthnicity(intake.applicant.ethnicity, "Maori"),
    applicant_ethnicity_pacific: isEthnicity(intake.applicant.ethnicity, "Pacific Peoples"),
    applicant_ethnicity_asian: isEthnicity(intake.applicant.ethnicity, "Asian"),
    applicant_ethnicity_melaa: isEthnicity(intake.applicant.ethnicity, "Middle Eastern / Latin American / African"),
    applicant_ethnicity_other: isEthnicity(intake.applicant.ethnicity, "Other"),
    application_type_1: selectedApplications[0],
    application_type_2: selectedApplications[1],
    application_type_3: selectedApplications[2],
    ...buildChildMergeFields(firstChild, 1),
    ...buildChildMergeFields(secondChild, 2),
    ...buildChildMergeFields(thirdChild, 3),
    ...buildChildMergeFields(fourthChild, 4),
    court_location: intake.courtLocation,
    date_today: today,
    "date_today ": today,
    Date_today: today,
    existing_child_orders: intake.proceedings.existingOrdersRelatingToChildren,
    existing_orders_between_parties:
      intake.proceedings.existingOrdersBetweenParties,
    marriage_date: formatInputDateForForms(intake.relationship.marriageOrCivilUnionDate),
    previous_applications: intake.proceedings.previousApplications,
    relationship_end_date: formatInputDateForForms(intake.relationship.relationshipEndDate),
    relationship_start_date: formatInputDateForForms(intake.relationship.deFactoRelationshipStart),
    todays_date: today,
    respondent_age: respondentAge,
    respondent_dob: formatInputDateForForms(intake.respondent.dateOfBirth),
    respondent_email: intake.respondent.emailAddress,
    respondent_home_address: intake.respondent.homeAddress,
    respondent_name: intake.respondent.fullName,
    respondent_occupation: intake.respondent.occupation,
    respondent_phone: intake.respondent.mobilePhone,
    respondent_ethnicity: respondentEthnicity,
    respondent_ethnicity_nz_european: isEthnicity(intake.respondent.ethnicity, "New Zealand European"),
    respondent_ethnicity_maori: isEthnicity(intake.respondent.ethnicity, "Maori"),
    respondent_ethnicity_pacific: isEthnicity(intake.respondent.ethnicity, "Pacific Peoples"),
    respondent_ethnicity_asian: isEthnicity(intake.respondent.ethnicity, "Asian"),
    respondent_ethnicity_melaa: isEthnicity(intake.respondent.ethnicity, "Middle Eastern / Latin American / African"),
    respondent_ethnicity_other: isEthnicity(intake.respondent.ethnicity, "Other"),
    respondent_relationship_to_applicant:
      intake.respondent.relationshipToApplicant,
    respondent_work_address: intake.respondent.workAddress,
    respondents_relationship_to_children:
      joinPresent(intake.children.slice(0, 4).map((child) => child.respondentRelationshipToChild)),
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
