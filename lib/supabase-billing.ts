import type { StoredBillingInvoice } from "./billing-storage";

export type SupabaseSaveResult =
  | { status: "saved" }
  | { status: "not_configured"; missing: string[] };

export async function saveBillingInvoiceToSupabase(
  invoice: StoredBillingInvoice,
): Promise<SupabaseSaveResult> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const missing = [
    supabaseUrl ? "" : "SUPABASE_URL",
    serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    return { status: "not_configured", missing };
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_invoices`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: invoice.id,
      client_id: invoice.clientId,
      client_name: invoice.clientName,
      legal_aid_number: invoice.legalAidNumber,
      fam_number: invoice.famNumber,
      invoice_number: invoice.invoiceNumber,
      invoice_total: invoice.invoiceTotal,
      form_type: invoice.formType,
      status: invoice.status,
      onedrive_url: invoice.oneDriveUrl,
      onedrive_path: invoice.oneDrivePath,
      generated_file_name: invoice.generatedFileName,
      generated_at: invoice.generatedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase billing invoice save failed with status ${response.status}.`);
  }

  return { status: "saved" };
}
