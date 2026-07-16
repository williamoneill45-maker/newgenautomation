export const applicationTypes = [
  "Without Notice Application for Protection Order",
  "Without Notice Application for Parenting Order",
  "Order Preventing Removal from New Zealand",
  "Other",
] as const;

export type ApplicationType = (typeof applicationTypes)[number];

export const courts = [
  "Auckland Court",
  "Manukau Court",
  "North Shore Court",
] as const;

export type CourtLocation = (typeof courts)[number] | "";

export const proceedingsTypes = [
  "protection_order",
  "care_of_children",
  "both",
] as const;

export type ProceedingsType = (typeof proceedingsTypes)[number] | "";

export const proceedingsTypeLabels: Record<Exclude<ProceedingsType, "">, string> = {
  protection_order: "Protection Order",
  care_of_children: "Parenting Order",
  both: "Both",
};

export function normalizeProceedingsType(value: string): ProceedingsType {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  if (normalized === "protection_order" || normalized === "protection") return "protection_order";
  if (normalized === "care_of_children" || normalized === "parenting_order" || normalized === "parenting") {
    return "care_of_children";
  }
  if (normalized === "both" || normalized === "protection_and_parenting") return "both";

  return "";
}

export const ethnicities = [
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

export type Ethnicity = (typeof ethnicities)[number] | "";

export type MatterStatus = "draft" | "ready_for_documents" | "documents_generated";

export type PartyRole = "applicant" | "respondent";

export type Party = {
  id: string;
  matterId: string;
  role: PartyRole;
  title?: "" | "Mr" | "Mrs" | "Ms" | "Miss" | "Mx" | "Custom";
  customTitle?: string;
  fullName: string;
  dateOfBirth: string;
  gender: "" | "F" | "M";
  occupation: string;
  mobilePhone: string;
  emailAddress: string;
  homeAddress: string;
  workAddress: string;
  ethnicity: Ethnicity;
  otherEthnicity: string;
  relationshipToApplicant?: string;
  isAddressConfidential?: boolean;
};

export type Child = {
  id: string;
  matterId: string;
  fullName: string;
  age: string;
  dateOfBirth: string;
  gender: "" | "F" | "M";
  livingWithName: string;
  livingWithRelationshipToChild: string;
  applicantRelationshipToChild: string;
  respondentRelationshipToChild: string;
  ethnicity: Ethnicity;
  otherEthnicity: string;
};

export type RelationshipDetails = {
  marriageOrCivilUnionDate: string;
  marriageOrCivilUnionPlace: string;
  deFactoRelationshipStart: string;
  relationshipEndDate: string;
};

export type ExistingProceedings = {
  previousApplications: string;
  existingOrdersBetweenParties: string;
  existingOrdersRelatingToChildren: string;
};

export type DomesticViolenceNotes = {
  history: string;
  recentEvents: string;
};

export type IntakeData = {
  selectedApplications: ApplicationType[];
  proceedingsType: ProceedingsType;
  otherApplicationDetails: string;
  courtLocation: CourtLocation;
  famNumber: string;
  msdClientNumber: string;
  applicant: Party;
  respondent: Party;
  relationship: RelationshipDetails;
  children: Child[];
  proceedings: ExistingProceedings;
  domesticViolenceNotes: DomesticViolenceNotes;
};

export type MatterFile = {
  id: string;
  legalAidNumber: string;
  clientName: string;
  legalAidRequired: boolean;
  status: MatterStatus;
  createdAt: string;
  updatedAt: string;
  intake: IntakeData;
};

export const documentTypes = [
  "information_sheet",
  "confidential_address_application",
  "parenting_order_application",
  "protection_order_application",
  "domestic_violence_affidavit",
  "legal_aid_application",
  "family_court_lawyer_certificate",
  "msd_police_information_request",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export type UploadedTemplate = {
  id: string;
  matterId?: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  placeholderKeys: PlaceholderKey[];
  uploadedAt: string;
};

export type GeneratedDocument = {
  id: string;
  matterId: string;
  templateId: string;
  documentType: DocumentType;
  status: "queued" | "generated" | "failed";
  mergeFields: Partial<Record<PlaceholderKey, string>>;
  docxStoragePath?: string;
  pdfStoragePath?: string;
  generatedAt?: string;
};

export const placeholderKeys = [
  "APPLICANT_NAME",
  "APPLICANT_FIRST_NAME",
  "RESPONDENT_NAME",
  "APPLICANT_ADDRESS",
  "RESPONDENT_ADDRESS",
  "COURT_LOCATION",
  "CHILD_1_NAME",
  "CHILD_1_DOB",
  "CHILD_1_AGE",
  "APPLICATION_TYPE_1",
  "APPLICATION_TYPE_2",
  "APPLICATION_TYPE_3",
  "English_court_name",
  "Maori_court_name",
  "month_day",
  "month",
  "a_dob",
  "x",
  "ag",
  "respont_phone",
  "r_dob",
  "z",
  "rg",
  "respont_occupation",
  "marriage_place",
  "start",
  "applicant_dob",
  "applicant_home_address",
  "applicant_occupation",
  "applicant_phone_number",
  "applicant_phone",
  "applicant_email",
  "respondent_phone",
  "respondent_email",
  "applicant_ethnicity",
  "applicant_ethnicity_nz_european",
  "applicant_ethnicity_maori",
  "applicant_ethnicity_pacific",
  "applicant_ethnicity_asian",
  "applicant_ethnicity_melaa",
  "applicant_ethnicity_other",
  "respondent_ethnicity",
  "respondent_ethnicity_nz_european",
  "respondent_ethnicity_maori",
  "respondent_ethnicity_pacific",
  "respondent_ethnicity_asian",
  "respondent_ethnicity_melaa",
  "respondent_ethnicity_other",
  "child_1_dob",
  "child_1_ethnicity",
  "child_1_ethnicity_nz_european",
  "child_1_ethnicity_maori",
  "child_1_ethnicity_pacific",
  "child_1_ethnicity_asian",
  "child_1_ethnicity_melaa",
  "child_1_ethnicity_other",
  "child_1_name",
  "child_1_nickname",
  "(“child_1_nickname”)",
  "date_today",
  "date_today ",
  "Date_today",
  "todays_date",
  "respondent_age",
  "respondent_dob",
  "respondent_home_address",
  "respondent_occupation",
  "respondent_work_address",
  "respondents_relationship_to_children",
  "applicant_age",
  "applicant_name",
  "application_type_1",
  "application_type_2",
  "application_type_3",
  "child_1_age",
  "c1a",
  "c1dob",
  "c1g",
  "c1living",
  "c1rta",
  "c1rtr",
  "c1e",
  "child_1_gender",
  "child_1_living_with",
  "child_1_relationship_to_applicant",
  "child_1_relationship_to_respondent",
  "child_2_age",
  "c2a",
  "c2dob",
  "c2g",
  "c2living",
  "c2iving",
  "c2rta",
  "c2rtr",
  "c2e",
  "child_2_dob",
  "child_2_ethnicity",
  "child_2_ethnicity_nz_european",
  "child_2_ethnicity_maori",
  "child_2_ethnicity_pacific",
  "child_2_ethnicity_asian",
  "child_2_ethnicity_melaa",
  "child_2_ethnicity_other",
  "child_2_gender",
  "child_2_living_with",
  "child_2_name",
  "child_2_nickname",
  "(“child_2_nickname”)",
  "child_2_relationship_to_applicant",
  "child_2_relationship_to_respondent",
  "child_3_age",
  "c3a",
  "c3dob",
  "c3g",
  "c3living",
  "c3rta",
  "c3rtr",
  "c3e",
  "child_3_dob",
  "child_3_ethnicity",
  "child_3_ethnicity_nz_european",
  "child_3_ethnicity_maori",
  "child_3_ethnicity_pacific",
  "child_3_ethnicity_asian",
  "child_3_ethnicity_melaa",
  "child_3_ethnicity_other",
  "child_3_gender",
  "child_3_living_with",
  "child_3_name",
  "child_3_nickname",
  "(“child_3_nickname”)",
  "child_3_relationship_to_applicant",
  "child_3_relationship_to_respondent",
  "child_4_age",
  "child_4_dob",
  "child_4_ethnicity",
  "child_4_ethnicity_nz_european",
  "child_4_ethnicity_maori",
  "child_4_ethnicity_pacific",
  "child_4_ethnicity_asian",
  "child_4_ethnicity_melaa",
  "child_4_ethnicity_other",
  "child_4_gender",
  "child_4_living_with",
  "child_4_name",
  "child_4_nickname",
  "(“child_4_nickname”)",
  "child_4_relationship_to_applicant",
  "child_4_relationship_to_respondent",
  "court_location",
  "existing_child_orders",
  "existing_orders_between_parties",
  "marriage_date",
  "previous_applications",
  "relationship_end_date",
  "relationship_start_date",
  "respondent_name",
  "respondent_relationship_to_applicant",
  "relationship_start_blurb",
  "relationship_end",
  "violence_categories",
  "insert_history_blurb",
  "insert_recent_events_blurb",
  "children_blurb",
  "affidavit_application_title",
  "protection_facts_heading",
  "application_intro",
  "without_notice_heading",
  "without_notice_intro",
  "without_notice_safety",
  "parenting_heading",
  "parenting_blurb",
  "orders_sought_blurb",
  "msd_client_number",
] as const;

export type PlaceholderKey = (typeof placeholderKeys)[number];

export function createEmptyParty(role: PartyRole, matterId: string): Party {
  return {
    id: `${role}-primary`,
    matterId,
    role,
    title: "",
    customTitle: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
    occupation: "",
    mobilePhone: "",
    emailAddress: "",
    homeAddress: "",
    workAddress: "",
    ethnicity: "",
    otherEthnicity: "",
    relationshipToApplicant: "",
    isAddressConfidential: role === "applicant" ? false : undefined,
  };
}

export function createEmptyChild(matterId: string, index: number): Child {
  return {
    id: `child-${Date.now()}-${index}`,
    matterId,
    fullName: "",
    age: "",
    dateOfBirth: "",
    gender: "",
    livingWithName: "",
    livingWithRelationshipToChild: "Mother",
    applicantRelationshipToChild: "Mother",
    respondentRelationshipToChild: "Father",
    ethnicity: "",
    otherEthnicity: "",
  };
}

export function createEmptyMatter(): MatterFile {
  const matterId = `matter-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    id: matterId,
    legalAidNumber: "",
    clientName: "",
    legalAidRequired: true,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    intake: {
      selectedApplications: [],
      proceedingsType: "",
      otherApplicationDetails: "",
      courtLocation: "",
      famNumber: "",
      msdClientNumber: "",
      applicant: createEmptyParty("applicant", matterId),
      respondent: createEmptyParty("respondent", matterId),
      relationship: {
        marriageOrCivilUnionDate: "",
        marriageOrCivilUnionPlace: "",
        deFactoRelationshipStart: "",
        relationshipEndDate: "",
      },
      children: [],
      proceedings: {
        previousApplications: "",
        existingOrdersBetweenParties: "",
        existingOrdersRelatingToChildren: "",
      },
      domesticViolenceNotes: {
        history: "",
        recentEvents: "",
      },
    },
  };
}
