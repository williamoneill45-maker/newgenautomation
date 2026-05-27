import type { BillingFormType, BillingRecord, BillingStatus } from "./billing-automation";

export type BillingClientProfile = {
  id: string;
  clientName: string;
  legalAidNumber: string;
  famNumber: string;
  clientEmail?: string;
  applicationType?: "parenting" | "protection" | "both" | "";
  oneDriveClientFolderPath?: string;
  oneDriveFormsFolderPath?: string;
  oneDriveBillingFolderPath?: string;
  oneDriveClientFolderUrl?: string;
  inductionRequestPath?: string;
  engagementStatus?: "not_started" | "sent" | "completed" | "failed";
  adobeAgreementId?: string;
  adobeAgreementStatus?: "not_sent" | "sent" | "signed" | "error";
  adobeAgreementSentAt?: string;
  adobeAgreementName?: string;
  adobeAgreementError?: string;
  requiredDocumentOneUploaded?: boolean;
  requiredDocumentTwoUploaded?: boolean;
  msdRequestStatus?: "not_started" | "sent" | "received" | "failed";
  legalAidApplicationStatus?: "not_started" | "pending_signed_forms_and_msd" | "ready_to_generate" | "generated";
  signedFormsPath?: string;
  msdResponsePath?: string;
  inductionRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredBillingInvoice = {
  id: string;
  clientId: string;
  clientName: string;
  legalAidNumber: string;
  famNumber: string;
  invoiceNumber: string;
  invoiceTotal: number;
  formType: BillingFormType;
  status: BillingStatus | "generated" | "ready_to_generate" | "onedrive_pending" | "onedrive_uploaded";
  missingEvidence?: string[];
  evidenceFiles?: Array<{
    label: string;
    fileName: string;
    storagePath: string;
    uploadedAt: string;
  }>;
  billingRecord?: BillingRecord;
  oneDriveUrl: string;
  oneDrivePath: string;
  generatedFileName: string;
  generatedAt: string;
};

export const billingClientsStorageKey = "newgenautomation:billingClients";
export const billingInvoicesStorageKey = "newgenautomation:billingInvoices";
export const billingRetentionDays = 90;

export function createBillingClientId(clientName: string): string {
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `client-${slug || Date.now()}`;
}

export function normalizeClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getClientLastName(clientName: string): string {
  const parts = normalizeClientName(clientName).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export function formatInvoiceNumber(date: string, formType: BillingFormType, clientName: string): string {
  const datePart = date.replace(/-/g, "") || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const surname = getClientLastName(clientName).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "CLIENT";
  return `${datePart}.${formType}.${surname}`;
}

export function getBillingRetentionCutoff(): number {
  return Date.now() - billingRetentionDays * 24 * 60 * 60 * 1000;
}

export function isInvoiceWithinRetention(invoice: StoredBillingInvoice): boolean {
  const generatedAt = new Date(invoice.generatedAt).getTime();
  return Number.isNaN(generatedAt) || generatedAt >= getBillingRetentionCutoff();
}
