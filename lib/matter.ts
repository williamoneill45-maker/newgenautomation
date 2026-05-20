export const applicationTypes = [
  "Without Notice Application for Protection Order",
  "Without Notice Application for Parenting Order",
  "Order Preventing Removal from New Zealand",
  "Other",
] as const;

export type ApplicationType = (typeof applicationTypes)[number];

export const courts = [
  "Manukau Court",
  "Auckland Court",
  "North Shore Court",
  "Waitakere Court",
] as const;

export type CourtLocation = (typeof courts)[number] | "";

export const ethnicities = [
  "New Zealand European",
  "Maori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern / Latin American / African",
  "Other",
] as const;

export type Ethnicity = (typeof ethnicities)[number] | "";

export type MatterStatus = "draft" | "ready_for_documents" | "documents_generated";

export type PartyRole = "applicant" | "respondent";

export type Party = {
  id: string;
  matterId: string;
  role: PartyRole;
  fullName: string;
  dateOfBirth: string;
  occupation: string;
  mobilePhone: string;
  emailAddress: string;
  homeAddress: string;
  workAddress: string;
  ethnicity: Ethnicity;
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
  courtLocation: CourtLocation;
  famNumber: string;
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
  "applicant_dob",
  "applicant_home_address",
  "applicant_occupation",
  "applicant_phone_number",
  "child_1_dob",
  "child_1_name",
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
  "child_1_gender",
  "child_1_living_with",
  "child_1_relationship_to_applicant",
  "child_1_relationship_to_respondent",
  "child_2_age",
  "child_2_dob",
  "child_2_gender",
  "child_2_living_with",
  "child_2_name",
  "child_2_relationship_to_applicant",
  "child_2_relationship_to_respondent",
  "court_location",
  "existing_child_orders",
  "existing_orders_between_parties",
  "marriage_date",
  "previous_applications",
  "relationship_end_date",
  "relationship_start_date",
  "respondent_name",
  "respondent_relationship_to_applicant",
] as const;

export type PlaceholderKey = (typeof placeholderKeys)[number];

export function createEmptyParty(role: PartyRole, matterId: string): Party {
  return {
    id: `${role}-primary`,
    matterId,
    role,
    fullName: "",
    dateOfBirth: "",
    occupation: "",
    mobilePhone: "",
    emailAddress: "",
    homeAddress: "",
    workAddress: "",
    ethnicity: "",
    relationshipToApplicant: role === "respondent" ? "" : undefined,
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
    livingWithRelationshipToChild: "",
    applicantRelationshipToChild: "",
    respondentRelationshipToChild: "",
    ethnicity: "",
  };
}

export function createEmptyMatter(): MatterFile {
  const matterId = `matter-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    id: matterId,
    legalAidNumber: "",
    clientName: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    intake: {
      selectedApplications: [],
      courtLocation: "",
      famNumber: "",
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
