import type { TemplateScanReport } from "./template-scanner";
import type { StudioTemplateDefinition } from "./template-studio";

export const templateStorageBucket = "legal-templates";

export type ManagedTemplateStatus = "draft" | "active" | "archived";

export type TemplateVersionRecord = {
  id: string;
  templateId: string;
  studioId: string;
  versionNumber: number;
  storagePath: string;
  originalFileName: string;
  status: ManagedTemplateStatus;
  notes: string;
  scanResult: TemplateScanReport | null;
  createdAt: string;
  createdBy: string;
};

export type TemplateManifest = {
  status: "loaded";
  template: {
    id: string;
    studioId: string;
    name: string;
    documentType: string;
    templateKind: string;
    activeVersionId: string;
    updatedAt: string;
  };
  versions: TemplateVersionRecord[];
} | {
  status: "not_configured" | "schema_missing";
  missing?: string[];
  message: string;
  versions: TemplateVersionRecord[];
};

type TemplateUnavailable =
  | { status: "not_configured"; missing?: string[]; message: string; versions: TemplateVersionRecord[] }
  | { status: "schema_missing"; missing?: string[]; message: string; versions: TemplateVersionRecord[] };

type TemplateRow = {
  id: string;
  studio_id: string;
  name: string;
  document_type: string;
  template_kind: string;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  template_id: string;
  studio_id: string;
  version_number: number;
  storage_path: string;
  original_filename: string;
  status: ManagedTemplateStatus;
  notes: string | null;
  scan_result: TemplateScanReport | null;
  created_at: string;
  created_by: string | null;
};

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    missing: [supabaseUrl ? "" : "SUPABASE_URL", serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY"].filter(Boolean),
  };
}

function headers(serviceKey: string, extra: HeadersInit = {}): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

function jsonHeaders(serviceKey: string, prefer?: string): HeadersInit {
  return headers(serviceKey, {
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  });
}

function isSchemaMissing(response: Response): boolean {
  return response.status === 404 || response.status === 406 || response.status === 400;
}

function mapVersion(row: VersionRow): TemplateVersionRecord {
  return {
    id: row.id,
    templateId: row.template_id,
    studioId: row.studio_id,
    versionNumber: row.version_number,
    storagePath: row.storage_path,
    originalFileName: row.original_filename,
    status: row.status,
    notes: row.notes ?? "",
    scanResult: row.scan_result,
    createdAt: row.created_at,
    createdBy: row.created_by ?? "",
  };
}

function templateId(studioId: string): string {
  return `template-${studioId}`;
}

function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "template";
}

async function requestJson<T>(url: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; response: Response; text: string }> {
  const response = await fetch(url, init);
  if (!response.ok) {
    return { ok: false, response, text: await response.text().catch(() => "") };
  }
  return { ok: true, data: await response.json() as T };
}

async function upsertTemplateRow(template: StudioTemplateDefinition): Promise<TemplateUnavailable | { status: "ready"; row: TemplateRow }> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) {
    return {
      status: "not_configured",
      missing,
      message: `Supabase template storage is not configured. Missing: ${missing.join(", ")}.`,
      versions: [],
    };
  }

  const response = await requestJson<TemplateRow[]>(
    `${supabaseUrl}/rest/v1/templates?on_conflict=id`,
    {
      method: "POST",
      headers: jsonHeaders(serviceKey, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({
        id: templateId(template.studioId),
        studio_id: template.studioId,
        name: template.title,
        document_type: template.id,
        template_kind: template.kind,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    if (isSchemaMissing(response.response)) {
      return {
        status: "schema_missing",
        message: "Supabase template tables are not installed yet. Repository templates are still being used.",
        versions: [],
      };
    }
    throw new Error(`Template row upsert failed with status ${response.response.status}. ${response.text}`);
  }

  return { status: "ready", row: response.data[0] };
}

export async function getTemplateManifest(template: StudioTemplateDefinition): Promise<TemplateManifest> {
  const rowResult = await upsertTemplateRow(template);
  if (rowResult.status !== "ready") return rowResult;

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const response = await requestJson<VersionRow[]>(
    `${supabaseUrl}/rest/v1/template_versions?template_id=eq.${encodeURIComponent(rowResult.row.id)}&select=*&order=version_number.desc`,
    { headers: headers(serviceKey), cache: "no-store" },
  );

  if (!response.ok) {
    if (isSchemaMissing(response.response)) {
      return {
        status: "schema_missing",
        message: "Supabase template version table is not installed yet. Repository templates are still being used.",
        versions: [],
      };
    }
    throw new Error(`Template versions load failed with status ${response.response.status}. ${response.text}`);
  }

  return {
    status: "loaded",
    template: {
      id: rowResult.row.id,
      studioId: rowResult.row.studio_id,
      name: rowResult.row.name,
      documentType: rowResult.row.document_type,
      templateKind: rowResult.row.template_kind,
      activeVersionId: rowResult.row.active_version_id ?? "",
      updatedAt: rowResult.row.updated_at,
    },
    versions: response.data.map(mapVersion),
  };
}

export async function uploadTemplateVersion(input: {
  template: StudioTemplateDefinition;
  file: File;
  scanResult: TemplateScanReport;
  createdBy?: string;
  notes?: string;
}): Promise<TemplateManifest> {
  const rowResult = await upsertTemplateRow(input.template);
  if (rowResult.status !== "ready") return rowResult;

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const manifest = await getTemplateManifest(input.template);
  const nextVersion = manifest.status === "loaded"
    ? Math.max(0, ...manifest.versions.map((version) => version.versionNumber)) + 1
    : 1;
  const versionId = crypto.randomUUID();
  const fileName = input.file.name.toLowerCase().endsWith(".docx") ? input.file.name : `${input.file.name}.docx`;
  const storagePath = `${safeSegment(input.template.studioId)}/${versionId}/template.docx`;

  const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/${templateStorageBucket}/${storagePath}`, {
    method: "POST",
    headers: headers(serviceKey, {
      "Content-Type": input.file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "x-upsert": "false",
    }),
    body: new Uint8Array(await input.file.arrayBuffer()),
  });

  if (!uploadResponse.ok) {
    if (uploadResponse.status === 404) {
      return {
        status: "schema_missing",
        message: `Supabase storage bucket "${templateStorageBucket}" is not installed yet.`,
        versions: manifest.versions,
      };
    }
    throw new Error(`Template upload failed with status ${uploadResponse.status}.`);
  }

  const versionResponse = await requestJson<VersionRow[]>(
    `${supabaseUrl}/rest/v1/template_versions`,
    {
      method: "POST",
      headers: jsonHeaders(serviceKey, "return=representation"),
      body: JSON.stringify({
        id: versionId,
        template_id: rowResult.row.id,
        studio_id: input.template.studioId,
        version_number: nextVersion,
        storage_path: storagePath,
        original_filename: fileName,
        status: "draft",
        notes: input.notes ?? "",
        scan_result: input.scanResult,
        created_by: input.createdBy ?? "admin",
      }),
      cache: "no-store",
    },
  );

  if (!versionResponse.ok) {
    throw new Error(`Template version save failed with status ${versionResponse.response.status}. ${versionResponse.text}`);
  }

  return getTemplateManifest(input.template);
}

export async function downloadTemplateVersion(path: string): Promise<ArrayBuffer> {
  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) throw new Error(`Supabase is missing ${missing.join(", ")}.`);

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${templateStorageBucket}/${path}`, {
    headers: headers(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Template version download failed with status ${response.status}.`);
  return response.arrayBuffer();
}

async function patchVersionStatus(templateIdValue: string, versionId: string, status: ManagedTemplateStatus) {
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/template_versions?template_id=eq.${encodeURIComponent(templateIdValue)}&id=eq.${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(serviceKey),
      body: JSON.stringify({ status }),
    },
  );
  if (!response.ok) throw new Error(`Template version status update failed with status ${response.status}.`);
}

export async function activateTemplateVersion(template: StudioTemplateDefinition, versionId: string): Promise<TemplateManifest> {
  const manifest = await getTemplateManifest(template);
  if (manifest.status !== "loaded") return manifest;
  const selected = manifest.versions.find((version) => version.id === versionId);
  if (!selected) throw new Error("Template version was not found.");

  await Promise.all(
    manifest.versions.map((version) =>
      patchVersionStatus(manifest.template.id, version.id, version.id === versionId ? "active" : "archived"),
    ),
  );

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/templates?id=eq.${encodeURIComponent(manifest.template.id)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(serviceKey),
      body: JSON.stringify({ active_version_id: versionId, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Template activation failed with status ${response.status}.`);

  return getTemplateManifest(template);
}

export async function getActiveTemplateVersion(template: StudioTemplateDefinition): Promise<TemplateVersionRecord | null> {
  const manifest = await getTemplateManifest(template);
  if (manifest.status !== "loaded") return null;
  return manifest.versions.find((version) => version.id === manifest.template.activeVersionId)
    ?? manifest.versions.find((version) => version.status === "active")
    ?? null;
}
