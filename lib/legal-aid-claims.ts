export type LegalAidClaimStatus = "Unpaid" | "Paid" | "Part Paid";

export type LegalAidClaim = {
  id: string;
  firmId: string;
  claimId: string;
  clientName: string;
  matterName: string;
  formType: "32B" | "33A";
  amountClaimed: number;
  dateSent: string;
  paidStatus: LegalAidClaimStatus;
  datePaid: string;
  amountPaid: number;
  outstandingAmount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LegalAidClaimInput = {
  claimId?: string;
  clientName: string;
  matterName: string;
  formType: "32B" | "33A";
  amountClaimed: number;
  dateSent?: string;
  notes?: string;
};

type ClaimRow = {
  id: string;
  firm_id: string;
  claim_id: string;
  client_name: string;
  matter_name: string;
  form_type: "32B" | "33A";
  amount_claimed: number | string;
  date_sent: string;
  paid_status: LegalAidClaimStatus;
  date_paid: string | null;
  amount_paid: number | string;
  outstanding_amount: number | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClaimsResult<T> =
  | { status: "loaded"; data: T }
  | { status: "not_configured"; missing: string[] };

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    firmId: process.env.NEWGEN_FIRM_ID?.trim() || "newgen",
    missing: [supabaseUrl ? "" : "SUPABASE_URL", serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
  };
}

function nzDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function currentMonthRange() {
  const today = nzDate();
  const [year, month] = today.split("-").map(Number);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${nextMonth.year}-${String(nextMonth.month).padStart(2, "0")}-01`,
  };
}

function headers(serviceKey: string, prefer?: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function mapRow(row: ClaimRow): LegalAidClaim {
  return {
    id: row.id,
    firmId: row.firm_id,
    claimId: row.claim_id,
    clientName: row.client_name,
    matterName: row.matter_name,
    formType: row.form_type,
    amountClaimed: Number(row.amount_claimed) || 0,
    dateSent: row.date_sent,
    paidStatus: row.paid_status,
    datePaid: row.date_paid ?? "",
    amountPaid: Number(row.amount_paid) || 0,
    outstandingAmount: Number(row.outstanding_amount) || 0,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateClaimId(formType: "32B" | "33A"): string {
  return `CLAIM-${nzDate().replace(/-/g, "")}-${formType}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function listCurrentMonthClaims(): Promise<ClaimsResult<LegalAidClaim[]>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const range = currentMonthRange();
  const params = new URLSearchParams({
    select: "*",
    firm_id: `eq.${firmId}`,
    date_sent: `gte.${range.start}`,
    order: "date_sent.desc,created_at.desc",
  });
  params.append("date_sent", `lt.${range.end}`);
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${params}`, {
    headers: headers(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Legal Aid claims load failed with status ${response.status}.`);
  return { status: "loaded", data: ((await response.json()) as ClaimRow[]).map(mapRow) };
}

export async function createLegalAidClaim(input: LegalAidClaimInput): Promise<ClaimsResult<LegalAidClaim>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const amountClaimed = Math.max(0, Number(input.amountClaimed) || 0);
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims`, {
    method: "POST",
    headers: headers(serviceKey, "return=representation"),
    body: JSON.stringify({
      firm_id: firmId,
      claim_id: input.claimId?.trim() || generateClaimId(input.formType),
      client_name: input.clientName.trim().toLocaleUpperCase("en-NZ"),
      matter_name: input.matterName.trim(),
      form_type: input.formType,
      amount_claimed: amountClaimed,
      date_sent: input.dateSent || nzDate(),
      paid_status: "Unpaid",
      amount_paid: 0,
      outstanding_amount: amountClaimed,
      notes: input.notes?.trim() ?? "",
    }),
  });
  if (!response.ok) throw new Error(`Legal Aid claim save failed with status ${response.status}.`);
  const [row] = (await response.json()) as ClaimRow[];
  return { status: "loaded", data: mapRow(row) };
}

export async function updateLegalAidClaim(input: {
  id: string;
  markPaid?: boolean;
  amountPaid?: number;
  datePaid?: string;
  notes?: string;
}): Promise<ClaimsResult<LegalAidClaim>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const filter = new URLSearchParams({ select: "*", id: `eq.${input.id}`, firm_id: `eq.${firmId}`, limit: "1" });
  const existingResponse = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${filter}`, {
    headers: headers(serviceKey),
    cache: "no-store",
  });
  if (!existingResponse.ok) throw new Error(`Legal Aid claim lookup failed with status ${existingResponse.status}.`);
  const [existing] = (await existingResponse.json()) as ClaimRow[];
  if (!existing) throw new Error("Legal Aid claim was not found for this firm.");

  const claimed = Number(existing.amount_claimed) || 0;
  const amountPaid = input.markPaid
    ? claimed
    : Math.min(claimed, Math.max(0, Number(input.amountPaid) || 0));
  const paidStatus: LegalAidClaimStatus = amountPaid >= claimed ? "Paid" : amountPaid > 0 ? "Part Paid" : "Unpaid";
  const datePaid = paidStatus === "Unpaid" ? null : input.datePaid || nzDate();
  const updateFilter = new URLSearchParams({ id: `eq.${input.id}`, firm_id: `eq.${firmId}` });
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${updateFilter}`, {
    method: "PATCH",
    headers: headers(serviceKey, "return=representation"),
    body: JSON.stringify({
      paid_status: paidStatus,
      date_paid: datePaid,
      amount_paid: amountPaid,
      outstanding_amount: Math.max(0, claimed - amountPaid),
      notes: input.notes ?? existing.notes ?? "",
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Legal Aid claim update failed with status ${response.status}.`);
  const [row] = (await response.json()) as ClaimRow[];
  return { status: "loaded", data: mapRow(row) };
}
