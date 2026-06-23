import type { MatterFile } from "./matter";

export type MattersResult<T> =
  | { status: "loaded"; data: T }
  | { status: "saved"; data?: T }
  | { status: "deleted" }
  | { status: "not_configured"; missing: string[] };

type MatterRow = {
  id: string;
  client_id?: string | null;
  client_name: string;
  legal_aid_number?: string | null;
  fam_number?: string | null;
  legal_aid_required?: boolean | null;
  status?: MatterFile["status"] | null;
  intake_json?: MatterFile["intake"] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    missing: [supabaseUrl ? "" : "SUPABASE_URL", serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
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

function mapRow(row: MatterRow): MatterFile {
  const intake = row.intake_json ?? {
    selectedApplications: [],
    proceedingsType: "",
    otherApplicationDetails: "",
    courtLocation: "",
    famNumber: row.fam_number ?? "",
    msdClientNumber: "",
    applicant: {
      id: `applicant-${row.id}`,
      matterId: row.id,
      role: "applicant",
      fullName: row.client_name,
      dateOfBirth: "",
      gender: "",
      occupation: "",
      mobilePhone: "",
      emailAddress: "",
      homeAddress: "",
      workAddress: "",
      ethnicity: "",
      otherEthnicity: "",
      relationshipToApplicant: "",
      isAddressConfidential: false,
    },
    respondent: {
      id: `respondent-${row.id}`,
      matterId: row.id,
      role: "respondent",
      fullName: "",
      dateOfBirth: "",
      gender: "",
      occupation: "",
      mobilePhone: "",
      emailAddress: "",
      homeAddress: "",
      workAddress: "",
      ethnicity: "",
      otherEthnicity: "",
      relationshipToApplicant: "",
    },
    relationship: {
      marriageOrCivilUnionDate: "",
      marriageOrCivilUnionPlace: "",
      deFactoRelationshipStart: "",
      relationshipEndDate: "",
    },
    children: [],
    proceedings: {
      previousApplications: "",
      existingOrdersBetweenParties: "",
      existingOrdersRelatingToChildren: "",
    },
    domesticViolenceNotes: {
      history: "",
      recentEvents: "",
    },
  } satisfies MatterFile["intake"];

  return {
    id: row.id,
    clientName: row.client_name,
    legalAidNumber: row.legal_aid_number ?? "",
    legalAidRequired: row.legal_aid_required ?? true,
    status: row.status ?? "draft",
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    intake: {
      ...intake,
      famNumber: intake.famNumber || row.fam_number || "",
    },
  };
}

export async function listMattersFromSupabase(): Promise<MattersResult<MatterFile[]>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const response = await fetch(`${supabaseUrl}/rest/v1/matters?select=*&order=updated_at.desc`, {
    headers: headers(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Matter load failed with status ${response.status}.`);
  const rows = (await response.json()) as MatterRow[];
  return { status: "loaded", data: rows.map(mapRow) };
}

export async function saveMatterToSupabase(matter: MatterFile, clientId = ""): Promise<MattersResult<MatterFile>> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) return { status: "not_configured", missing };

  const response = await fetch(`${supabaseUrl}/rest/v1/matters?on_conflict=id`, {
    method: "POST",
    headers: headers(serviceKey, "resolution=merge-duplicates,return=representation"),
    body: JSON.stringify({
      id: matter.id,
      client_id: clientId,
      client_name: matter.clientName || matter.intake.applicant.fullName,
      legal_aid_number: matter.legalAidNumber ?? "",
      fam_number: matter.intake.famNumber ?? "",
      legal_aid_required: matter.legalAidRequired ?? true,
      status: matter.status,
      intake_json: matter.intake,
      created_at: matter.createdAt,
      updated_at: matter.updatedAt || new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Matter save failed with status ${response.status}.`);
  const rows = (await response.json()) as MatterRow[];
  return { status: "saved", data: rows[0] ? mapRow(rows[0]) : matter };
}
