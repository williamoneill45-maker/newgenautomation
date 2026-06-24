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

export function calculateChildDisplayAge(dateOfBirth: string, asAt = new Date()): string {
  const match = dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return calculateAge(dateOfBirth, asAt);

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]) - 1;
  const birthDay = Number(match[3]);
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  if (Number.isNaN(birthDate.getTime()) || birthDate > asAt) return "";

  let months = (asAt.getFullYear() - birthYear) * 12 + asAt.getMonth() - birthMonth;
  if (asAt.getDate() < birthDay) months -= 1;
  if (months < 12) return `${Math.max(months, 0)}m`;

  return String(Math.floor(months / 12));
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

function formatInputDateLong(value: string): string {
  if (!value) return "";

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatOrdinalDay(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;

  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

const courtNames: Record<string, { english: string; maori: string }> = {
  auckland: { english: "Auckland", maori: "Tāmaki Makaurau" },
  manukau: { english: "Manukau", maori: "Manukau" },
  "north shore": { english: "North Shore", maori: "Ōkahukura" },
};

function getCourtNames(value: string): { english: string; maori: string } {
  const normalized = value.toLowerCase().replace(/\bcourt\b/g, "").replace(/\s+/g, " ").trim();
  const mapped = courtNames[normalized];
  if (mapped) return mapped;

  const fallback = value.replace(/\s+court$/i, "").trim();
  return { english: fallback, maori: fallback };
}

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function getQuotedFirstName(fullName: string): string {
  const firstName = getFirstName(fullName).toLocaleUpperCase("en-NZ");
  return firstName ? `“${firstName}”` : "";
}

function getParenthesizedNickname(fullName: string): string {
  const nickname = getQuotedFirstName(fullName);
  return nickname ? `(${nickname})` : "";
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

const informationSheetEthnicities = [
  "New Zealand European",
  "Māori",
  "Samoan",
  "Cook Island Māori",
  "Tongan",
  "Niuean",
  "Chinese",
  "Indian",
  "Other",
] as const;

export function getInformationSheetEthnicityCheckboxes(value: string): boolean[] {
  const normalizedValue = normalizeEthnicity(value);
  return informationSheetEthnicities.map((option) => {
    const normalizedOption = normalizeEthnicity(option);
    if (normalizedOption === "maori") return normalizedValue === "maori";
    return normalizedValue === normalizedOption;
  });
}

function joinPresent(values: Array<string | undefined>): string {
  return values.filter((value) => value?.trim()).join("\n");
}

function getLivingWithLabel(
  child: Child,
  applicantName: string,
  respondentName: string,
): string {
  const livingWith = normalizeEthnicity(child.livingWithName);
  const applicant = normalizeEthnicity(applicantName);
  const respondent = normalizeEthnicity(respondentName);
  const role = livingWith === "respondent" || (respondent && livingWith === respondent)
    ? "Respondent"
    : livingWith === "applicant" || (applicant && livingWith === applicant)
      ? "Applicant"
      : child.livingWithName.toLocaleUpperCase("en-NZ") || "Applicant";
  const relationship = child.livingWithRelationshipToChild.trim();
  return relationship ? `${role}/${relationship}` : role;
}

function buildChildMergeFields(
  child: Child | undefined,
  index: 1 | 2 | 3 | 4,
  applicantName: string,
  respondentName: string,
): RawMergeFields {
  const prefix = `child_${index}`;
  const upperPrefix = `CHILD_${index}`;

  if (!child) {
    const emptyFields: RawMergeFields = {
      [`${prefix}_age`]: "",
      [`${prefix}_dob`]: "",
      [`${prefix}_ethnicity`]: "",
      [`${prefix}_ethnicity_nz_european`]: "",
      [`${prefix}_ethnicity_maori`]: "",
      [`${prefix}_ethnicity_pacific`]: "",
      [`${prefix}_ethnicity_asian`]: "",
      [`${prefix}_ethnicity_melaa`]: "",
      [`${prefix}_ethnicity_other`]: "",
      [`${prefix}_ethnicity_other_value`]: "",
      [`${prefix}_gender`]: "",
      [`${prefix}_living_with`]: "",
      [`${prefix}_name`]: "",
      [`${prefix}_nickname`]: "",
      [`(“${prefix}_nickname”)`]: "",
      [`${prefix}_relationship_to_applicant`]: "",
      [`${prefix}_relationship_to_respondent`]: "",
      [`${upperPrefix}_AGE`]: "",
      [`${upperPrefix}_DOB`]: "",
      [`${upperPrefix}_NAME`]: "",
    };
    if (index <= 3) {
      const shortPrefix = `c${index}`;
      for (const suffix of ["a", "dob", "g", "living", "rta", "rtr", "e"]) {
        emptyFields[`${shortPrefix}${suffix}`] = "";
      }
    }
    return emptyFields;
  }

  const childEthnicity = getEthnicity(child.ethnicity, child.otherEthnicity);
  const childOtherEthnicity = child.ethnicity === "Other" ? child.otherEthnicity.trim() : "";
  const childName = child.fullName.toLocaleUpperCase("en-NZ");
  const nickname = getQuotedFirstName(childName);
  const childAge = calculateChildDisplayAge(child.dateOfBirth) || child.age;
  const livingWith = getLivingWithLabel(child, applicantName, respondentName);

  const shortPrefix = index <= 3 ? `c${index}` : "";

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
    [`${prefix}_ethnicity_other_value`]: childOtherEthnicity,
    [`${prefix}_gender`]: child?.gender,
    [`${prefix}_living_with`]: livingWith,
    [`${prefix}_name`]: childName,
    [`${prefix}_nickname`]: nickname,
    [`(“${prefix}_nickname”)`]: getParenthesizedNickname(childName),
    [`${prefix}_relationship_to_applicant`]: child?.applicantRelationshipToChild,
    [`${prefix}_relationship_to_respondent`]: child?.respondentRelationshipToChild,
    [`${upperPrefix}_AGE`]: childAge,
    [`${upperPrefix}_DOB`]: formatInputDateForForms(child.dateOfBirth),
    [`${upperPrefix}_NAME`]: childName,
    ...(shortPrefix
      ? {
          [`${shortPrefix}a`]: childAge,
          [`${shortPrefix}dob`]: formatInputDateForForms(child.dateOfBirth),
          [`${shortPrefix}g`]: child.gender,
          [`${shortPrefix}living`]: livingWith,
          [`${shortPrefix}rta`]: child.applicantRelationshipToChild,
          [`${shortPrefix}rtr`]: child.respondentRelationshipToChild,
          [`${shortPrefix}e`]: childEthnicity,
          ...(index === 2 ? { c2iving: livingWith } : {}),
        }
      : {}),
  };
}

export function buildMatterMergeFields(matter: MatterFile): MergeFields {
  const { intake } = matter;
  const firstChild = intake.children[0];
  const secondChild = intake.children[1];
  const thirdChild = intake.children[2];
  const fourthChild = intake.children[3];
  const today = formatDateForForms();
  const todayDate = new Date();
  const court = getCourtNames(intake.courtLocation);
  const applicantAddress = intake.applicant.isAddressConfidential
    ? "Confidential Address"
    : intake.applicant.homeAddress;
  const childAge = calculateChildDisplayAge(firstChild?.dateOfBirth ?? "") || firstChild?.age || "";
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
  const applicantOtherEthnicity =
    intake.applicant.ethnicity === "Other" ? intake.applicant.otherEthnicity.trim() : "";
  const respondentOtherEthnicity =
    intake.respondent.ethnicity === "Other" ? intake.respondent.otherEthnicity.trim() : "";
  const applicantName = intake.applicant.fullName.toLocaleUpperCase("en-NZ");
  const respondentName = intake.respondent.fullName.toLocaleUpperCase("en-NZ");
  const englishCourtName = court.english.toLocaleUpperCase("en-NZ");
  const maoriCourtName = court.maori.toLocaleUpperCase("mi-NZ");
  const numberOfChildren = intake.children.length ? String(intake.children.length) : "";

  return normalizeMergeFields({
    APPLICANT_NAME: applicantName,
    APPLICANT_FIRST_NAME: getFirstName(applicantName),
    RESPONDENT_NAME: respondentName,
    APPLICANT_ADDRESS: applicantAddress,
    RESPONDENT_ADDRESS: intake.respondent.homeAddress,
    COURT_LOCATION: englishCourtName,
    CHILD_1_NAME: firstChild?.fullName.toLocaleUpperCase("en-NZ"),
    CHILD_1_DOB: formatInputDateForForms(firstChild?.dateOfBirth ?? ""),
    CHILD_1_AGE: childAge,
    APPLICATION_TYPE_1: selectedApplications[0],
    APPLICATION_TYPE_2: selectedApplications[1],
    APPLICATION_TYPE_3: selectedApplications[2],
    English_court_name: englishCourtName,
    Maori_court_name: maoriCourtName,
    court: englishCourtName,
    month_day: formatOrdinalDay(todayDate.getDate()),
    month: new Intl.DateTimeFormat("en-NZ", { month: "long" }).format(todayDate),
    a_dob: formatInputDateForForms(intake.applicant.dateOfBirth),
    x: applicantAge,
    ag: intake.applicant.gender ?? "",
    applicant_age: applicantAge,
    applicant_dob: formatInputDateForForms(intake.applicant.dateOfBirth),
    applicant_home_address: applicantAddress,
    applicant_name: applicantName,
    applicant_occupation: intake.applicant.occupation,
    APPLICANT_MOBILE: intake.applicant.mobilePhone,
    APPLICANT_PHONE: intake.applicant.mobilePhone,
    APPLICANT_PHONE_NUMBER: intake.applicant.mobilePhone,
    APPLICANT_EMAIL: intake.applicant.emailAddress,
    applicant_mobile: intake.applicant.mobilePhone,
    applicant_phone_number: intake.applicant.mobilePhone,
    applicant_phone: intake.applicant.mobilePhone,
    applicant_email: intake.applicant.emailAddress,
    EMAIL: intake.applicant.emailAddress,
    MOBILE: intake.applicant.mobilePhone,
    MOBILE_PHONE: intake.applicant.mobilePhone,
    email: intake.applicant.emailAddress,
    mobile: intake.applicant.mobilePhone,
    mobile_phone: intake.applicant.mobilePhone,
    applicant_ethnicity: applicantEthnicity,
    applicant_ethnicity_other_value: applicantOtherEthnicity,
    applicant_ethnicity_nz_european: isEthnicity(intake.applicant.ethnicity, "New Zealand European"),
    applicant_ethnicity_maori: isEthnicity(intake.applicant.ethnicity, "Maori"),
    applicant_ethnicity_pacific: isEthnicity(intake.applicant.ethnicity, "Pacific Peoples"),
    applicant_ethnicity_asian: isEthnicity(intake.applicant.ethnicity, "Asian"),
    applicant_ethnicity_melaa: isEthnicity(intake.applicant.ethnicity, "Middle Eastern / Latin American / African"),
    applicant_ethnicity_other: isEthnicity(intake.applicant.ethnicity, "Other"),
    application_type_1: selectedApplications[0],
    application_type_2: selectedApplications[1],
    application_type_3: selectedApplications[2],
    ...buildChildMergeFields(firstChild, 1, applicantName, respondentName),
    ...buildChildMergeFields(secondChild, 2, applicantName, respondentName),
    ...buildChildMergeFields(thirdChild, 3, applicantName, respondentName),
    ...buildChildMergeFields(fourthChild, 4, applicantName, respondentName),
    court_location: `${englishCourtName} | ${maoriCourtName}`,
    date_today: today,
    "date_today ": today,
    Date_today: today,
    existing_child_orders: intake.proceedings.existingOrdersRelatingToChildren,
    existing_orders_between_parties:
      intake.proceedings.existingOrdersBetweenParties,
    marriage_date: formatInputDateForForms(intake.relationship.marriageOrCivilUnionDate),
    marriage_place: intake.relationship.marriageOrCivilUnionPlace,
    previous_applications: intake.proceedings.previousApplications,
    relationship_end_date: formatInputDateForForms(intake.relationship.relationshipEndDate),
    relationship_start_date: formatInputDateForForms(intake.relationship.deFactoRelationshipStart),
    start: formatInputDateForForms(intake.relationship.deFactoRelationshipStart),
    NUMBER_OF_CHILDREN: numberOfChildren,
    NUMBEROFCHILDREN: numberOfChildren,
    NUMBEROFCHIDLREN: numberOfChildren,
    NUMBER_OF_CHIDLREN: numberOfChildren,
    number_of_children: numberOfChildren,
    numberofchildren: numberOfChildren,
    numberofchidlren: numberOfChildren,
    number_of_chidlren: numberOfChildren,
    todays_date: today,
    respondent_age: respondentAge,
    respondent_dob: formatInputDateForForms(intake.respondent.dateOfBirth),
    respondent_email: intake.respondent.emailAddress,
    respondent_home_address: intake.respondent.homeAddress,
    respondent_name: respondentName,
    respondent_occupation: intake.respondent.occupation,
    respondent_phone: intake.respondent.mobilePhone,
    respont_phone: intake.respondent.mobilePhone,
    r_dob: formatInputDateForForms(intake.respondent.dateOfBirth),
    z: respondentAge,
    rg: intake.respondent.gender ?? "",
    respont_occupation: intake.respondent.occupation,
    respondent_ethnicity: respondentEthnicity,
    respondent_ethnicity_other_value: respondentOtherEthnicity,
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
      joinPresent(intake.children.map((child) => child.respondentRelationshipToChild)),
    respondents_name: respondentName,
    "respondents_name ": respondentName,
    "respondents_relationshib to child": firstChild?.respondentRelationshipToChild,
    msd_client_number: intake.msdClientNumber ?? "",
  });
}

export function buildTemplateMergeFields(
  matter: MatterFile,
  documentType: DocumentType,
): MergeFields {
  const fields = buildMatterMergeFields(matter);
  if (documentType !== "parenting_order_application") return fields;

  const overrides: RawMergeFields = {};
  matter.intake.children.forEach((child, index) => {
    const childNumber = index + 1;
    overrides[`child_${childNumber}_name`] = child.fullName.toLocaleUpperCase("en-NZ");
    overrides[`child_${childNumber}_dob`] = formatInputDateLong(child.dateOfBirth);
    overrides[`(“child_${childNumber}_nickname”)`] = getParenthesizedNickname(child.fullName);
  });

  return { ...fields, ...normalizeMergeFields(overrides) };
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
  return `{{${key}}`;
}
