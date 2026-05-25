import type { BillingClientProfile, StoredBillingInvoice } from "./billing-storage";

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
      evidence_files_json: invoice.evidenceFiles ?? [],
      billing_record_json: invoice.billingRecord ?? null,
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

export async function saveBillingClientToSupabase(
  client: BillingClientProfile,
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

  const payload: Record<string, unknown> = {
    id: client.id,
    client_name: client.clientName,
    legal_aid_number: client.legalAidNumber ?? "",
    updated_at: client.updatedAt || new Date().toISOString(),
  };
  const optionalColumns: Array<[string, unknown]> = [
    ["client_email", client.clientEmail],
    ["application_type", client.applicationType],
    ["onedrive_client_folder_path", client.oneDriveClientFolderPath],
    ["onedrive_forms_folder_path", client.oneDriveFormsFolderPath],
    ["onedrive_billing_folder_path", client.oneDriveBillingFolderPath],
    ["onedrive_client_folder_url", client.oneDriveClientFolderUrl],
    ["induction_request_path", client.inductionRequestPath],
    ["engagement_status", client.engagementStatus],
    ["msd_request_status", client.msdRequestStatus],
    ["legal_aid_application_status", client.legalAidApplicationStatus],
    ["signed_forms_path", client.signedFormsPath],
    ["msd_response_path", client.msdResponsePath],
    ["induction_requested_at", client.inductionRequestedAt || null],
  ];

  for (const [key, value] of optionalColumns) {
    if (value !== undefined) payload[key] = value;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_clients?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Supabase billing client save failed with status ${response.status}.`);
  }

  return { status: "saved" };
}

export async function updateBillingClientInductionInSupabase(
  client: BillingClientProfile,
): Promise<SupabaseSaveResult> {
  return saveBillingClientToSupabase({
    ...client,
    updatedAt: new Date().toISOString(),
  });
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
    evidence_files_json?: StoredBillingInvoice["evidenceFiles"];
    billing_record_json?: StoredBillingInvoice["billingRecord"];
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
      evidenceFiles: Array.isArray(row.evidence_files_json) ? row.evidence_files_json : [],
      billingRecord: row.billing_record_json,
      oneDriveUrl: row.onedrive_url ?? "",
      oneDrivePath: row.onedrive_path ?? "",
      generatedFileName: row.generated_file_name ?? "",
      generatedAt: row.generated_at ?? "",
    })),
  };
}

export async function listBillingClientsFromSupabase(): Promise<
  | { status: "loaded"; clients: BillingClientProfile[] }
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
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/billing_clients?select=*&order=updated_at.desc`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase billing client load failed with status ${response.status}.`);
  }

  const rows = await response.json() as Array<{
    id: string;
    client_name: string;
    legal_aid_number?: string;
    client_email?: string;
    application_type?: BillingClientProfile["applicationType"];
    onedrive_client_folder_path?: string;
    onedrive_forms_folder_path?: string;
    onedrive_billing_folder_path?: string;
    onedrive_client_folder_url?: string;
    induction_request_path?: string;
    engagement_status?: BillingClientProfile["engagementStatus"];
    msd_request_status?: BillingClientProfile["msdRequestStatus"];
    legal_aid_application_status?: BillingClientProfile["legalAidApplicationStatus"];
    signed_forms_path?: string;
    msd_response_path?: string;
    induction_requested_at?: string;
    created_at?: string;
    updated_at?: string;
  }>;

  return {
    status: "loaded",
    clients: rows.map((row) => ({
      id: row.id,
      clientName: row.client_name,
      legalAidNumber: row.legal_aid_number ?? "",
      famNumber: "",
      clientEmail: row.client_email ?? "",
      applicationType: row.application_type ?? "",
      oneDriveClientFolderPath: row.onedrive_client_folder_path ?? "",
      oneDriveFormsFolderPath: row.onedrive_forms_folder_path ?? "",
      oneDriveBillingFolderPath: row.onedrive_billing_folder_path ?? "",
      oneDriveClientFolderUrl: row.onedrive_client_folder_url ?? "",
      inductionRequestPath: row.induction_request_path ?? "",
      engagementStatus: row.engagement_status ?? "not_started",
      msdRequestStatus: row.msd_request_status ?? "not_started",
      legalAidApplicationStatus: row.legal_aid_application_status ?? "not_started",
      signedFormsPath: row.signed_forms_path ?? "",
      msdResponsePath: row.msd_response_path ?? "",
      inductionRequestedAt: row.induction_requested_at ?? "",
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
    })),
  };
}

export async function uploadBillingEvidenceToSupabase(input: {
  invoiceId: string;
  evidenceLabel: string;
  file: File;
}): Promise<
  | { status: "uploaded"; storagePath: string }
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

  const safeLabel = input.evidenceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evidence";
  const safeName = input.file.name.replace(/[^A-Za-z0-9._-]+/g, "-");
  const storagePath = `${input.invoiceId}/${safeLabel}/${Date.now()}-${safeName}`;
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/billing/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": input.file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: await input.file.arrayBuffer(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase billing evidence upload failed with status ${response.status}.`);
  }

  return { status: "uploaded", storagePath };
}
