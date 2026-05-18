export const applicationTypes = [
  "Without Notice Application for Protection Order",
  "Without Notice Application for Parenting Order",
  "Order Preventing Removal from New Zealand",
  "Other",
] as const;

export type ApplicationType = (typeof applicationTypes)[number];

export const courts = [
  "Auckland Family Court",
  "Manukau Family Court",
  "Hamilton Family Court",
  "Wellington Family Court",
  "Christchurch Family Court",
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
  livingWithAndRelationship: string;
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
  matterNumber: string;
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
    livingWithAndRelationship: "",
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
    matterNumber: "",
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
