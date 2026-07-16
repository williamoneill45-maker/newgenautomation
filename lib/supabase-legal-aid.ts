import {
  getLegalAidStatus,
  legalAidTemplatePath,
  type LegalAidRecord,
  type LegalAidReview,
  type LegalAidStatus,
} from "./legal-aid.ts";

const legalAidBucket = "legal-aid-uploads";

export type SupabaseLegalAidResult<T> =
  | { status: "loaded"; data: T }
  | { status: "not_configured"; missing: string[] };

type LegalAidApplicationRow = {
  id: string;
  matter_id: string;
  client_name: string;
  status: LegalAidStatus;
  review: LegalAidReview;
  has_income_proof: boolean;
  has_signed_page: boolean;
  income_proof_path: string | null;
  signed_page_path: string | null;
  income_proof_file_name: string | null;
  signed_page_file_name: string | null;
  template_path: string;
  created_at: string;
  updated_at: string;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const missing = [
    supabaseUrl ? "" : "SUPABASE_URL",
    serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    missing,
  };
}

function serviceHeaders(serviceKey: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

function toRecord(row: LegalAidApplicationRow): LegalAidRecord {
  return {
    id: row.id,
    matterId: row.matter_id,
    clientName: row.client_name,
    status: row.status,
    review: row.review,
    hasIncomeProof: row.has_income_proof,
    hasSignedPage: row.has_signed_page,
    incomeProofPath: row.income_proof_path ?? "",
    signedPagePath: row.signed_page_path ?? "",
    incomeProofFileName: row.income_proof_file_name ?? "",
    signedPageFileName: row.signed_page_file_name ?? "",
    templatePath: row.template_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(record: LegalAidRecord) {
  return {
    id: record.id,
    matter_id: record.matterId,
    client_name: record.clientName,
    status: record.status === "generated" || record.status === "submitted"
      ? record.status
      : getLegalAidStatus(record.hasIncomeProof, record.hasSignedPage),
    review: record.review,
    has_income_proof: record.hasIncomeProof,
    has_signed_page: record.hasSignedPage,
    income_proof_path: record.incomeProofPath || null,
    signed_page_path: record.signedPagePath || null,
    income_proof_file_name: record.incomeProofFileName || null,
    signed_page_file_name: record.signedPageFileName || null,
    template_path: record.templatePath || legalAidTemplatePath,
    updated_at: new Date().toISOString(),
  };
}

function buildStoragePath(applicationId: string, kind: "incomeProof" | "signedPage", fileName: string) {
  const extension = fileName.match(/\.[A-Za-z0-9]+$/)?.[0]?.toLowerCase() ?? "";
  const safeKind = kind === "incomeProof" ? "income-proof" : "signed-page-5";
  return `${applicationId}/${safeKind}${extension}`;
}

export function createLegalAidRecord(review: LegalAidReview): LegalAidRecord {
  const now = new Date().toISOString();
  const id = `legal-aid-${review.matterId || crypto.randomUUID()}`;

  return {
    id,
    matterId: review.matterId,
    clientName: review.clientName,
    status: "draft",
    review,
    hasIncomeProof: false,
    hasSignedPage: false,
    incomeProofPath: "",
    signedPagePath: "",
    incomeProofFileName: "",
    signedPageFileName: "",
    templatePath: legalAidTemplatePath,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveLegalAidApplicationToSupabase(
  record: LegalAidRecord,
): Promise<SupabaseLegalAidResult<LegalAidRecord>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_applications`, {
    method: "POST",
    headers: serviceHeaders(serviceKey, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(toRow(record)),
  });

  if (!response.ok) {
    throw new Error(`Supabase Legal Aid save failed with status ${response.status}.`);
  }

  const rows = await response.json() as LegalAidApplicationRow[];
  return { status: "loaded", data: toRecord(rows[0]) };
}

export async function getLegalAidApplicationFromSupabase(
  id: string,
): Promise<SupabaseLegalAidResult<LegalAidRecord | null>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/legal_aid_applications?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    {
      headers: serviceHeaders(serviceKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase Legal Aid load failed with status ${response.status}.`);
  }

  const rows = await response.json() as LegalAidApplicationRow[];
  return { status: "loaded", data: rows[0] ? toRecord(rows[0]) : null };
}

export async function listLegalAidApplicationsFromSupabase(
  pendingOnly = false,
): Promise<SupabaseLegalAidResult<LegalAidRecord[]>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const statusFilter = pendingOnly
    ? "&status=in.(pending_income_proof,pending_signed_page,draft)"
    : "";
  const response = await fetch(
    `${supabaseUrl}/rest/v1/legal_aid_applications?select=*&order=updated_at.desc${statusFilter}`,
    {
      headers: serviceHeaders(serviceKey),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase Legal Aid list failed with status ${response.status}.`);
  }

  const rows = await response.json() as LegalAidApplicationRow[];
  return { status: "loaded", data: rows.map(toRecord) };
}

export async function uploadLegalAidFileToSupabase(
  application: LegalAidRecord,
  kind: "incomeProof" | "signedPage",
  file: File,
): Promise<SupabaseLegalAidResult<LegalAidRecord>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const objectPath = buildStoragePath(application.id, kind, file.name);
  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/${legalAidBucket}/${objectPath}`,
    {
      method: "POST",
      headers: serviceHeaders(serviceKey, {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      }),
      body: new Uint8Array(await file.arrayBuffer()),
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`Supabase Legal Aid upload failed with status ${uploadResponse.status}.`);
  }

  const nextApplication: LegalAidRecord = {
    ...application,
    hasIncomeProof: kind === "incomeProof" ? true : application.hasIncomeProof,
    hasSignedPage: kind === "signedPage" ? true : application.hasSignedPage,
    incomeProofPath: kind === "incomeProof" ? objectPath : application.incomeProofPath,
    signedPagePath: kind === "signedPage" ? objectPath : application.signedPagePath,
    incomeProofFileName: kind === "incomeProof" ? file.name : application.incomeProofFileName,
    signedPageFileName: kind === "signedPage" ? file.name : application.signedPageFileName,
  };

  return saveLegalAidApplicationToSupabase(nextApplication);
}

export async function downloadLegalAidFileFromSupabase(path: string): Promise<Uint8Array> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) {
    throw new Error(`Supabase is missing ${missing.join(", ")}.`);
  }

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${legalAidBucket}/${path}`, {
    headers: serviceHeaders(serviceKey),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase Legal Aid download failed with status ${response.status}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
