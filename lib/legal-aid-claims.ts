export type LegalAidPaymentStatus = "Unpaid" | "Paid" | "Part Paid";
export type LegalAidClaimLifecycle = "Draft" | "Generated" | "Sent" | "Paid" | "Overdue";

export type LegalAidClaim = {
  id: string;
  firmId: string;
  claimId: string;
  clientName: string;
  legalAidNumber: string;
  matterName: string;
  formType: "32B" | "33A";
  amountClaimed: number;
  dateGenerated: string;
  dateSent: string;
  lifecycleStatus: LegalAidClaimLifecycle;
  paidStatus: LegalAidPaymentStatus;
  datePaid: string;
  amountPaid: number;
  outstandingAmount: number;
  storageProvider: string;
  storageLocation: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LegalAidClaimInput = {
  claimId?: string;
  clientName: string;
  legalAidNumber?: string;
  matterName: string;
  formType: "32B" | "33A";
  amountClaimed: number;
  dateGenerated?: string;
  dateSent?: string;
  lifecycleStatus?: LegalAidClaimLifecycle;
  storageProvider?: string;
  storageLocation?: string;
  notes?: string;
};

type ClaimRow = {
  id: string;
  firm_id: string;
  claim_id: string;
  client_name: string;
  legal_aid_number?: string | null;
  matter_name: string;
  form_type: "32B" | "33A";
  amount_claimed: number | string;
  date_generated?: string | null;
  date_sent: string | null;
  claim_status?: LegalAidClaimLifecycle | null;
  paid_status: LegalAidPaymentStatus;
  date_paid: string | null;
  amount_paid: number | string;
  outstanding_amount: number | string;
  storage_provider?: string | null;
  storage_location?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClaimsResult<T> =
  | { status: "loaded"; data: T }
  | { status: "not_configured"; missing: string[] };

const followUpDays = 14;

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

export function nzDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function headers(serviceKey: string, prefer?: string): HeadersInit {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
}

export function claimIsOverdue(claim: Pick<LegalAidClaim, "dateSent" | "outstandingAmount" | "lifecycleStatus">, today = nzDate()): boolean {
  if (!claim.dateSent || claim.outstandingAmount <= 0 || claim.lifecycleStatus === "Paid") return false;
  const sent = new Date(`${claim.dateSent}T00:00:00+12:00`).getTime();
  const current = new Date(`${today}T00:00:00+12:00`).getTime();
  return current - sent > followUpDays * 24 * 60 * 60 * 1000;
}

export function derivePayment(amountClaimed: number, amountPaid: number): { paidStatus: LegalAidPaymentStatus; outstandingAmount: number } {
  const claimed = Math.max(0, amountClaimed || 0);
  const paid = Math.min(claimed, Math.max(0, amountPaid || 0));
  return { paidStatus: paid >= claimed && claimed > 0 ? "Paid" : paid > 0 ? "Part Paid" : "Unpaid", outstandingAmount: Math.max(0, claimed - paid) };
}

function mapRow(row: ClaimRow): LegalAidClaim {
  const amountClaimed = Number(row.amount_claimed) || 0;
  const amountPaid = Number(row.amount_paid) || 0;
  const payment = derivePayment(amountClaimed, amountPaid);
  const baseStatus = row.claim_status || (row.paid_status === "Paid" ? "Paid" : row.date_sent ? "Sent" : "Generated");
  const claim: LegalAidClaim = {
    id: row.id,
    firmId: row.firm_id,
    claimId: row.claim_id,
    clientName: row.client_name,
    legalAidNumber: row.legal_aid_number ?? "",
    matterName: row.matter_name,
    formType: row.form_type,
    amountClaimed,
    dateGenerated: row.date_generated ?? row.created_at.slice(0, 10),
    dateSent: row.date_sent ?? "",
    lifecycleStatus: baseStatus,
    paidStatus: payment.paidStatus,
    datePaid: row.date_paid ?? "",
    amountPaid,
    outstandingAmount: payment.outstandingAmount,
    storageProvider: row.storage_provider ?? "",
    storageLocation: row.storage_location ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return claimIsOverdue(claim) ? { ...claim, lifecycleStatus: "Overdue" } : claim;
}

function generateClaimId(formType: "32B" | "33A"): string {
  return `CLAIM-${nzDate().replace(/-/g, "")}-${formType}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export async function listLegalAidClaims(): Promise<ClaimsResult<LegalAidClaim[]>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const params = new URLSearchParams({ select: "*", firm_id: `eq.${firmId}`, order: "date_generated.desc,created_at.desc" });
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${params}`, { headers: headers(serviceKey), cache: "no-store" });
  if (!response.ok) throw new Error(`Legal Aid claims load failed with status ${response.status}.`);
  return { status: "loaded", data: ((await response.json()) as ClaimRow[]).map(mapRow) };
}

export async function createLegalAidClaim(input: LegalAidClaimInput): Promise<ClaimsResult<LegalAidClaim>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const amountClaimed = Math.max(0, Number(input.amountClaimed) || 0);
  const lifecycleStatus = input.lifecycleStatus === "Overdue" ? "Sent" : input.lifecycleStatus ?? (input.dateSent ? "Sent" : "Generated");
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims`, {
    method: "POST",
    headers: headers(serviceKey, "return=representation"),
    body: JSON.stringify({
      firm_id: firmId,
      claim_id: input.claimId?.trim() || generateClaimId(input.formType),
      client_name: input.clientName.trim().toLocaleUpperCase("en-NZ"),
      legal_aid_number: input.legalAidNumber?.trim() ?? "",
      matter_name: input.matterName.trim(),
      form_type: input.formType,
      amount_claimed: amountClaimed,
      date_generated: input.dateGenerated || nzDate(),
      date_sent: input.dateSent || null,
      claim_status: lifecycleStatus,
      paid_status: "Unpaid",
      amount_paid: 0,
      outstanding_amount: amountClaimed,
      storage_provider: input.storageProvider?.trim() ?? "",
      storage_location: input.storageLocation?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
    }),
  });
  if (!response.ok) throw new Error(`Legal Aid claim save failed with status ${response.status}.`);
  const [row] = (await response.json()) as ClaimRow[];
  return { status: "loaded", data: mapRow(row) };
}

export async function updateLegalAidClaim(input: {
  id: string;
  lifecycleStatus?: LegalAidClaimLifecycle;
  markPaid?: boolean;
  amountPaid?: number;
  dateSent?: string;
  datePaid?: string;
  storageProvider?: string;
  storageLocation?: string;
  notes?: string;
}): Promise<ClaimsResult<LegalAidClaim>> {
  const { supabaseUrl, serviceKey, firmId, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };
  const filter = new URLSearchParams({ select: "*", id: `eq.${input.id}`, firm_id: `eq.${firmId}`, limit: "1" });
  const existingResponse = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${filter}`, { headers: headers(serviceKey), cache: "no-store" });
  if (!existingResponse.ok) throw new Error(`Legal Aid claim lookup failed with status ${existingResponse.status}.`);
  const [existing] = (await existingResponse.json()) as ClaimRow[];
  if (!existing) throw new Error("Legal Aid claim was not found for this firm.");

  const claimed = Number(existing.amount_claimed) || 0;
  const amountPaid = input.markPaid ? claimed : Math.min(claimed, Math.max(0, input.amountPaid ?? Number(existing.amount_paid) ?? 0));
  const payment = derivePayment(claimed, amountPaid);
  let lifecycleStatus = input.lifecycleStatus === "Overdue" ? "Sent" : input.lifecycleStatus ?? existing.claim_status ?? "Generated";
  if (payment.paidStatus === "Paid") lifecycleStatus = "Paid";
  if (payment.paidStatus === "Part Paid" && ["Draft", "Generated"].includes(lifecycleStatus)) lifecycleStatus = "Sent";
  const dateSent = lifecycleStatus === "Sent" || lifecycleStatus === "Paid" ? input.dateSent || existing.date_sent || nzDate() : input.dateSent || existing.date_sent;
  const datePaid = payment.paidStatus === "Unpaid" ? null : input.datePaid || existing.date_paid || nzDate();
  const response = await fetch(`${supabaseUrl}/rest/v1/legal_aid_claims?${new URLSearchParams({ id: `eq.${input.id}`, firm_id: `eq.${firmId}` })}`, {
    method: "PATCH",
    headers: headers(serviceKey, "return=representation"),
    body: JSON.stringify({
      claim_status: lifecycleStatus,
      date_sent: dateSent || null,
      paid_status: payment.paidStatus,
      date_paid: datePaid,
      amount_paid: amountPaid,
      outstanding_amount: payment.outstandingAmount,
      storage_provider: input.storageProvider ?? existing.storage_provider ?? "",
      storage_location: input.storageLocation ?? existing.storage_location ?? "",
      notes: input.notes ?? existing.notes ?? "",
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Legal Aid claim update failed with status ${response.status}.`);
  const [row] = (await response.json()) as ClaimRow[];
  return { status: "loaded", data: mapRow(row) };
}
