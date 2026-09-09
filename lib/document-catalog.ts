import type { DocumentType, PlaceholderKey } from "./matter";

export type DocumentAutomationStage =
  | "intake_merge"
  | "ai_drafting"
  | "post_engagement_upload"
  | "pdf_assembly";

export type RequiredDocumentDefinition = {
  id: DocumentType;
  title: string;
  alwaysGenerate: boolean;
  stages: DocumentAutomationStage[];
  requiredPlaceholders: PlaceholderKey[];
  notes?: string;
};

export const requiredDocumentDefinitions: RequiredDocumentDefinition[] = [
  {
    id: "information_sheet",
    title: "Information Sheet",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: [
      "applicant_name",
      "respondent_name",
      "applicant_home_address",
      "respondent_home_address",
      "court_location",
      "child_1_name",
      "child_1_dob",
      "child_1_age",
      "application_type_1",
    ],
  },
  {
    id: "confidential_address_application",
    title: "Application for Confidential Address",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["applicant_name", "respondent_name", "court_location"],
  },
  {
    id: "parenting_order_application",
    title: "Application for Parenting Order",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: [
      "applicant_name",
      "respondent_name",
      "court_location",
      "child_1_name",
      "child_1_dob",
    ],
  },
  {
    id: "protection_order_application",
    title: "Application for Protection Order",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["applicant_name", "respondent_name", "court_location"],
  },
  {
    id: "domestic_violence_affidavit",
    title: "Domestic Violence Affidavit",
    alwaysGenerate: true,
    stages: ["intake_merge", "ai_drafting"],
    requiredPlaceholders: [
      "applicant_name",
      "respondent_name",
      "relationship_start_blurb",
      "relationship_end_blurb",
      "violence_categories",
      "insert_history_blurb",
      "insert_recent_events_blurb",
    ],
    notes:
      "Generate an editable DOCX affidavit from lawyer notes, including relationship, children, supported violence categories, history, recent events, and parenting sections when sought.",
  },
  {
    id: "legal_aid_application",
    title: "Legal Aid Application Form",
    alwaysGenerate: true,
    stages: ["intake_merge", "post_engagement_upload", "pdf_assembly"],
    requiredPlaceholders: ["applicant_name", "respondent_name"],
    notes:
      "Requires two later screenshots after the signed letter of engagement is returned. Store reminder tasks and uploaded screenshots under the matter before final PDF assembly.",
  },
  {
    id: "family_court_lawyer_certificate",
    title: "Family Court Lawyer Certificate",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["applicant_name", "respondent_name", "court_location"],
  },
  {
    id: "msd_police_information_request",
    title: "MSD Request and Police Information Sheet",
    alwaysGenerate: true,
    stages: ["intake_merge", "pdf_assembly"],
    requiredPlaceholders: ["applicant_name", "respondent_name"],
  },
];

export function getRequiredDocuments(): RequiredDocumentDefinition[] {
  return requiredDocumentDefinitions.filter((document) => document.alwaysGenerate);
}
