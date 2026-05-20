import type { BillingFormType, BillingStatus } from "./billing-automation";

export type BillingClientProfile = {
  id: string;
  clientName: string;
  legalAidNumber: string;
  famNumber: string;
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
  status: BillingStatus | "generated" | "onedrive_pending" | "onedrive_uploaded";
  oneDriveUrl: string;
  oneDrivePath: string;
  generatedFileName: string;
  generatedAt: string;
};

export const billingClientsStorageKey = "newgenautomation:billingClients";
export const billingInvoicesStorageKey = "newgenautomation:billingInvoices";

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
