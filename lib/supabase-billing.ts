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

  const clientResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_clients?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: invoice.clientId,
      client_name: invoice.clientName,
      legal_aid_number: invoice.legalAidNumber ?? "",
      updated_at: new Date().toISOString(),
    }),
  });

  if (!clientResponse.ok) {
    throw new Error(`Supabase billing client save failed with status ${clientResponse.status}.`);
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
      client_name: invoice.clientName,
      legal_aid_number: invoice.legalAidNumber ?? "",
      invoice_number: invoice.invoiceNumber,
      invoice_total: invoice.invoiceTotal,
      client_id: invoice.clientId,
      fam_number: "",
      form_type: invoice.formType,
      status: invoice.status,
      evidence_json: invoice.missingEvidence ?? [],
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

export async function listBillingInvoicesFromSupabase(): Promise<
  | { status: "loaded"; invoices: StoredBillingInvoice[] }
  | { status: "not_configured"; missing: string[] }
> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const missing = [
    supabaseUrl ? "" : "SUPABASE_URL",
    serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    return { status: "not_configured", missing };
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_invoices?select=*&order=generated_at.desc`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase billing invoice load failed with status ${response.status}.`);
  }

  const rows = await response.json() as Array<{
    id: string;
    client_id?: string;
    client_name: string;
    legal_aid_number: string;
    invoice_number: string;
    invoice_total: number | string;
    form_type?: StoredBillingInvoice["formType"];
    status?: StoredBillingInvoice["status"];
    evidence_json?: string[];
    onedrive_url?: string;
    onedrive_path?: string;
    generated_file_name?: string;
    generated_at?: string;
  }>;

  return {
    status: "loaded",
    invoices: rows.map((row) => ({
      id: row.id,
      clientId: row.client_id ?? "",
      clientName: row.client_name,
      legalAidNumber: row.legal_aid_number,
      famNumber: "",
      invoiceNumber: row.invoice_number,
      invoiceTotal: Number(row.invoice_total) || 0,
      formType: row.form_type ?? "32B",
      status: row.status ?? "generated",
      missingEvidence: Array.isArray(row.evidence_json) ? row.evidence_json : [],
      oneDriveUrl: row.onedrive_url ?? "",
      oneDrivePath: row.onedrive_path ?? "",
      generatedFileName: row.generated_file_name ?? "",
      generatedAt: row.generated_at ?? "",
    })),
  };
}
