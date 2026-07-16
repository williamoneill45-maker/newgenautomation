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
    outputFileName: "Information Sheet (COCA).docx",
  },
  {
    id: "information_sheet",
    title: "Information Sheet (FV)",
    sourceFileName: "Information Sheet Final 1.docx",
    outputFileName: "Information Sheet (FV).docx",
  },
  {
    id: "confidential_address_application",
    title: "Application for Confidential Address",
    sourceFileName: "Application for Confidential address 1.docx",
    outputFileName: "02 Application for Confidential Address.docx",
  },
  {
    id: "parenting_order_application",
    title: "Application for Parenting Order",
    sourceFileName: "Application for parenting order.docx",
    outputFileName: "03 Application for Parenting Order.docx",
  },
  {
    id: "protection_order_application",
    title: "Application for Protection Order",
    sourceFileName: "Application for Protection Order.docx",
    outputFileName: "04 Application for Protection Order.docx",
  },
  {
    id: "msd_police_information_request",
    title: "MSD Request",
    sourceFileName: "MSD Request.docx",
    outputFileName: "05 MSD Request.docx",
  },
  {
    id: "msd_police_information_request",
    title: "Police Information Sheet",
    sourceFileName: "Police Information Sheet.docx",
    outputFileName: "06 Police Information Sheet.docx",
  },
  {
    id: "family_court_lawyer_certificate",
    title: "Family Court Lawyer Certificate",
    sourceFileName: "family-court-lawyer-certificate.docx",
    outputFileName: "07 Family Court Lawyer Certificate.docx",
  },
  {
    id: "domestic_violence_affidavit",
    title: "Domestic Violence Affidavit",
    sourceFileName: "Domestic Violence Affidavit.docx",
    outputFileName: "08 Domestic Violence Affidavit.docx",
  },
];

