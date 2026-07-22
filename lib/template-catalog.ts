import type { DocumentType } from "./matter";

export type SourceTemplateDefinition = {
  id: DocumentType;
  title: string;
  sourceFileName: string;
  outputFileName: string;
};

export const standardDocxTemplates: SourceTemplateDefinition[] = [
  {
    id: "information_sheet",
    title: "Information Sheet (COCA)",
    sourceFileName: "Information Sheet Final 1.docx",
    outputFileName: "01 Information Sheet (COCA).docx",
  },
  {
    id: "information_sheet",
    title: "Information Sheet (FV)",
    sourceFileName: "Information Sheet Final 1.docx",
    outputFileName: "02 Information Sheet (FV).docx",
  },
  {
    id: "confidential_address_application",
    title: "Application for Confidential Address",
    sourceFileName: "Application for Confidential address 1.docx",
    outputFileName: "03 Application for Confidential Address.docx",
  },
  {
    id: "parenting_order_application",
    title: "Application for Parenting Order",
    sourceFileName: "Application for parenting order.docx",
    outputFileName: "04 Application for Parenting Order.docx",
  },
  {
    id: "protection_order_application",
    title: "Application for Protection Order",
    sourceFileName: "Application for Protection Order.docx",
    outputFileName: "05 Application for Protection Order.docx",
  },
  {
    id: "msd_police_information_request",
    title: "MSD Request",
    sourceFileName: "MSD Request.docx",
    outputFileName: "06 MSD Request.docx",
  },
  {
    id: "msd_police_information_request",
    title: "Police Information Sheet",
    sourceFileName: "Police Information Sheet.docx",
    outputFileName: "07 Police Information Sheet.docx",
  },
  {
    id: "family_court_lawyer_certificate",
    title: "Family Court Lawyer Certificate",
    sourceFileName: "family-court-lawyer-certificate.docx",
    outputFileName: "08 Family Court Lawyer Certificate.docx",
  },
  {
    id: "domestic_violence_affidavit",
    title: "Domestic Violence Affidavit",
    sourceFileName: "Domestic Violence Affidavit.docx",
    outputFileName: "09 Domestic Violence Affidavit.docx",
  },
  {
    id: "court_legal_aid_confirmation_letter",
    title: "Ltr to Court Confirming Legal Aid",
    sourceFileName: "court-letters/Ltr to Court Confirming Legal Aid.doc",
    outputFileName: "10 Ltr to Court Confirming Legal Aid.doc",
  },
  {
    id: "court_filing_documents_letter",
    title: "Ltr to Court Filing Docs",
    sourceFileName: "court-letters/Ltr to Court Filing Docs.doc",
    outputFileName: "11 Ltr to Court Filing Docs.doc",
  },
  {
    id: "court_filing_dv_applications_letter",
    title: "Ltr to Court Filing DV Applications",
    sourceFileName: "court-letters/Ltr to Court Filing DV Applications.doc",
    outputFileName: "12 Ltr to Court Filing DV Applications.doc",
  },
  {
    id: "mfi_service_letter",
    title: "Ltr to MFI",
    sourceFileName: "court-letters/Ltr to MFI.doc",
    outputFileName: "13 Ltr to MFI.doc",
  },
  {
    id: "police_information_request_email",
    title: "Police Email",
    sourceFileName: "court-letters/Police Email.doc",
    outputFileName: "14 Police Email.doc",
  },
];

export const confidentialAddressInformationSheet = {
  title: "Confidential Address Applicant Information Sheet",
  sourceFileName: "Confidential Address Applicant Information Sheet.pdf",
  outputFileName: "15 Confidential Address Applicant Information Sheet.pdf",
} as const;
