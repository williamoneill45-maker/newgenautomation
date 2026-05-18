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
      "APPLICANT_NAME",
      "RESPONDENT_NAME",
      "APPLICANT_ADDRESS",
      "RESPONDENT_ADDRESS",
      "COURT_LOCATION",
      "CHILD_1_NAME",
      "CHILD_1_DOB",
      "CHILD_1_AGE",
      "APPLICATION_TYPE_1",
    ],
  },
  {
    id: "confidential_address_application",
    title: "Application for Confidential Address",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME", "COURT_LOCATION"],
  },
  {
    id: "parenting_order_application",
    title: "Application for Parenting Order",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: [
      "APPLICANT_NAME",
      "RESPONDENT_NAME",
      "COURT_LOCATION",
      "CHILD_1_NAME",
      "CHILD_1_DOB",
    ],
  },
  {
    id: "protection_order_application",
    title: "Application for Protection Order",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME", "COURT_LOCATION"],
  },
  {
    id: "domestic_violence_affidavit",
    title: "Domestic Violence Affidavit",
    alwaysGenerate: true,
    stages: ["intake_merge", "ai_drafting"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME", "COURT_LOCATION"],
    notes:
      "Draft history of domestic violence and recent events in real time from lawyer notes, but keep the final wording editable before generation.",
  },
  {
    id: "legal_aid_application",
    title: "Legal Aid Application Form",
    alwaysGenerate: true,
    stages: ["intake_merge", "post_engagement_upload", "pdf_assembly"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME"],
    notes:
      "Requires two later screenshots after the signed letter of engagement is returned. Store reminder tasks and uploaded screenshots under the matter before final PDF assembly.",
  },
  {
    id: "family_court_lawyer_certificate",
    title: "Family Court Lawyer Certificate",
    alwaysGenerate: true,
    stages: ["intake_merge"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME", "COURT_LOCATION"],
  },
  {
    id: "msd_police_information_request",
    title: "MSD Request and Police Information Sheet",
    alwaysGenerate: true,
    stages: ["intake_merge", "pdf_assembly"],
    requiredPlaceholders: ["APPLICANT_NAME", "RESPONDENT_NAME"],
  },
];

export function getRequiredDocuments(): RequiredDocumentDefinition[] {
  return requiredDocumentDefinitions.filter((document) => document.alwaysGenerate);
}
