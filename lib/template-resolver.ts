import { readFile } from "node:fs/promises";
import path from "node:path";

import { downloadTemplateVersion, getActiveTemplateVersion, getTemplateManifest } from "./supabase-template-versions";
import type { StudioTemplateDefinition } from "./template-studio";

export type TemplateResolution = {
  buffer: ArrayBuffer;
  source: "managed" | "repository";
  versionId?: string;
};

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function readRepositoryTemplate(sourceFileName: string): Promise<ArrayBuffer> {
  return toArrayBuffer(await readFile(path.join(process.cwd(), "templates", sourceFileName)));
}

export async function resolveTemplateSource(
  template: StudioTemplateDefinition,
  options: { versionId?: string } = {},
): Promise<TemplateResolution> {
  if (options.versionId) {
    const manifest = await getTemplateManifest(template);
    if (manifest.status === "loaded") {
      const version = manifest.versions.find((item) => item.id === options.versionId);
      if (!version) throw new Error("Template version was not found.");
      return {
        buffer: await downloadTemplateVersion(version.storagePath),
        source: "managed",
        versionId: version.id,
      };
    }
  }

  try {
    const active = await getActiveTemplateVersion(template);
    if (active) {
      return {
        buffer: await downloadTemplateVersion(active.storagePath),
        source: "managed",
        versionId: active.id,
      };
    }
  } catch (error) {
    console.warn("Managed template resolution failed; falling back to repository template.", error);
  }

  return {
    buffer: await readRepositoryTemplate(template.sourceFileName),
    source: "repository",
  };
}
