import type { DocumentType } from "./matter";

export type DocumentWorkflowId = "protection_order" | "parenting_order" | "protection_and_parenting";

export type DocumentWorkflowItem = {
  templateId: DocumentType | "static_pdf";
  title: string;
  outputPrefix: string;
  includeWhen: string;
  requiredFields: string[];
  notes?: string;
};

export type DocumentWorkflowDefinition = {
  id: DocumentWorkflowId;
  title: string;
  description: string;
  items: DocumentWorkflowItem[];
};

export const documentWorkflows: DocumentWorkflowDefinition[] = [
  {
    id: "protection_order",
    title: "Protection Order",
    description: "Family violence bundle for a protection order application.",
    items: [
      {
        templateId: "information_sheet",
        title: "Information Sheet (FV)",
        outputPrefix: "02",
        includeWhen: "Always for protection order matters.",
        requiredFields: ["applicant_name", "respondent_name", "court_location"],
      },
      {
        templateId: "protection_order_application",
        title: "Protection Order application",
        outputPrefix: "05",
        includeWhen: "Protection order selected.",
        requiredFields: ["applicant_name", "respondent_name", "court_location", "date_today"],
      },
      {
        templateId: "domestic_violence_affidavit",
        title: "FV Violence Affidavit",
        outputPrefix: "09",
        includeWhen: "Protection order selected.",
        requiredFields: [
          "applicant_name",
          "respondent_name",
          "court_location",
          "court_location_maori",
          "relationship_start_date",
          "relationship_end_date",
          "violence_categories",
        ],
      },
      {
        templateId: "msd_police_information_request",
        title: "Police Information Sheet",
        outputPrefix: "07",
        includeWhen: "Protection order selected.",
        requiredFields: ["applicant_name", "respondent_name", "respondent_home_address"],
      },
      {
        templateId: "family_court_lawyer_certificate",
        title: "Lawyer Certificate",
        outputPrefix: "08",
        includeWhen: "Without notice application selected.",
        requiredFields: ["date_today"],
      },
      {
        templateId: "court_filing_dv_applications_letter",
        title: "Court filing DV applications letter",
        outputPrefix: "12",
        includeWhen: "Documents are ready for court filing.",
        requiredFields: ["applicant_last_name_upper", "respondent_last_name_upper"],
      },
      {
        templateId: "confidential_address_application",
        title: "Confidential Address application",
        outputPrefix: "03",
        includeWhen: "Applicant address confidential is selected.",
        requiredFields: ["applicant_name", "respondent_name", "applicant_home_address"],
      },
      {
        templateId: "court_legal_aid_confirmation_letter",
        title: "Court confirming legal aid letter",
        outputPrefix: "10",
        includeWhen: "Legal aid granted.",
        requiredFields: ["applicant_name", "applicant_last_name_upper", "respondent_last_name_upper"],
      },
      {
        templateId: "mfi_service_letter",
        title: "MFI letter",
        outputPrefix: "13",
        includeWhen: "MFI service required.",
        requiredFields: ["applicant_last_name_upper", "respondent_last_name_upper", "applicant_phone_number"],
      },
      {
        templateId: "police_information_request_email",
        title: "Police email",
        outputPrefix: "14",
        includeWhen: "Police information request required.",
        requiredFields: ["applicant_name", "respondent_name", "applicant_dob", "applicant_home_address"],
      },
    ],
  },
  {
    id: "parenting_order",
    title: "Parenting Order",
    description: "Care of Children Act bundle for a parenting order application.",
    items: [
      {
        templateId: "information_sheet",
        title: "Information Sheet (COCA)",
        outputPrefix: "01",
        includeWhen: "Always for parenting order matters.",
        requiredFields: ["applicant_name", "respondent_name", "court_location", "child_1_name"],
      },
      {
        templateId: "parenting_order_application",
        title: "Parenting Order application",
        outputPrefix: "04",
        includeWhen: "Parenting order selected.",
        requiredFields: ["applicant_name", "respondent_name", "child_1_name", "child_1_dob"],
      },
      {
        templateId: "domestic_violence_affidavit",
        title: "COCA Violence Affidavit",
        outputPrefix: "09",
        includeWhen: "Parenting order selected and affidavit required.",
        requiredFields: ["applicant_name", "respondent_name", "child_1_name", "relationship_start_date"],
      },
      {
        templateId: "family_court_lawyer_certificate",
        title: "Lawyer Certificate",
        outputPrefix: "08",
        includeWhen: "Without notice application selected.",
        requiredFields: ["date_today"],
      },
      {
        templateId: "court_filing_documents_letter",
        title: "Court filing documents letter",
        outputPrefix: "11",
        includeWhen: "Documents are ready for court filing.",
        requiredFields: ["applicant_last_name_upper", "respondent_last_name_upper"],
      },
    ],
  },
  {
    id: "protection_and_parenting",
    title: "Protection + Parenting",
    description: "Combined family violence and parenting bundle from the same intake.",
    items: [
      {
        templateId: "information_sheet",
        title: "Information Sheet (FV and COCA)",
        outputPrefix: "00",
        includeWhen: "Protection and parenting are both selected.",
        requiredFields: ["applicant_name", "respondent_name", "court_location", "child_1_name"],
      },
      {
        templateId: "protection_order_application",
        title: "Protection Order application",
        outputPrefix: "05",
        includeWhen: "Protection order selected.",
        requiredFields: ["applicant_name", "respondent_name", "court_location"],
      },
      {
        templateId: "parenting_order_application",
        title: "Parenting Order application",
        outputPrefix: "04",
        includeWhen: "Parenting order selected.",
        requiredFields: ["applicant_name", "respondent_name", "child_1_name", "child_1_dob"],
      },
      {
        templateId: "domestic_violence_affidavit",
        title: "FV and COCA Affidavit",
        outputPrefix: "09",
        includeWhen: "Combined affidavit required.",
        requiredFields: [
          "applicant_name",
          "respondent_name",
          "court_location",
          "child_1_name",
          "relationship_start_date",
          "violence_categories",
        ],
      },
      {
        templateId: "msd_police_information_request",
        title: "Police Information Sheet",
        outputPrefix: "07",
        includeWhen: "Protection order selected.",
        requiredFields: ["applicant_name", "respondent_name", "respondent_home_address"],
      },
      {
        templateId: "family_court_lawyer_certificate",
        title: "Lawyer Certificate",
        outputPrefix: "08",
        includeWhen: "Without notice application selected.",
        requiredFields: ["date_today"],
      },
      {
        templateId: "court_filing_dv_applications_letter",
        title: "Court filing DV applications letter",
        outputPrefix: "12",
        includeWhen: "Documents are ready for court filing.",
        requiredFields: ["applicant_last_name_upper", "respondent_last_name_upper"],
      },
    ],
  },
];

export function getDocumentWorkflow(id: DocumentWorkflowId): DocumentWorkflowDefinition | undefined {
  return documentWorkflows.find((workflow) => workflow.id === id);
}
