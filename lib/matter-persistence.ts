"use client";

import { recentMattersStorageKey } from "./legal-aid";
import type { MatterFile } from "./matter";

export type MatterLoadStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "empty"
  | "not_configured"
  | "cache"
  | "error";

export type MatterLoadResult = {
  status: MatterLoadStatus;
  matters: MatterFile[];
  message: string;
};

type MatterApiPayload = {
  status?: "loaded" | "not_configured";
  data?: MatterFile[];
  missing?: string[];
  error?: string;
};

type MatterSavePayload = {
  status?: "saved" | "not_configured";
  data?: MatterFile;
  missing?: string[];
  error?: string;
};

function uniqueMatters(matters: MatterFile[]): MatterFile[] {
  return matters.filter((matter, index, all) => all.findIndex((item) => item.id === matter.id) === index);
}

export function readCachedMatters(): MatterFile[] {
  try {
    const raw = window.localStorage.getItem(recentMattersStorageKey);
    return raw ? uniqueMatters(JSON.parse(raw) as MatterFile[]) : [];
  } catch {
    window.localStorage.removeItem(recentMattersStorageKey);
    return [];
  }
}

export function writeCachedMatters(matters: MatterFile[]) {
  window.localStorage.setItem(recentMattersStorageKey, JSON.stringify(uniqueMatters(matters).slice(0, 100)));
}

export function upsertCachedMatter(matter: MatterFile) {
  writeCachedMatters([matter, ...readCachedMatters().filter((item) => item.id !== matter.id)]);
}

export async function loadMattersFromSupabase(): Promise<MatterLoadResult> {
  try {
    const response = await fetch("/api/matters", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Matter API failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as MatterApiPayload;
    if (payload.status === "loaded") {
      const data = payload.data ?? [];
      writeCachedMatters(data);
      return {
        status: data.length ? "loaded" : "empty",
        matters: data,
        message: data.length
          ? "Matters loaded from Supabase."
          : "Supabase is configured and returned zero saved matters.",
      };
    }

    if (payload.status === "not_configured") {
      return {
        status: "not_configured",
        matters: [],
        message: `Supabase matter storage is not configured. Missing: ${(payload.missing ?? []).join(", ")}.`,
      };
    }

    throw new Error(payload.error || "Matter API returned an unexpected response.");
  } catch (error) {
    const cached = readCachedMatters();
    return {
      status: cached.length ? "cache" : "error",
      matters: cached,
      message: cached.length
        ? "Supabase matter storage could not be reached. Showing cached matters from this browser."
        : error instanceof Error ? error.message : "Unable to load matters from Supabase.",
    };
  }
}

export async function saveMatterToSupabase(matter: MatterFile, clientId = ""): Promise<MatterFile> {
  const matterToSave: MatterFile = {
    ...matter,
    clientName: matter.clientName || matter.intake.applicant.fullName,
    updatedAt: new Date().toISOString(),
  };
  const response = await fetch("/api/matters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matter: matterToSave, clientId }),
  });

  if (!response.ok) {
    throw new Error(`Matter save failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as MatterSavePayload;
  if (payload.status === "not_configured") {
    throw new Error(`Supabase matter storage is not configured. Missing: ${(payload.missing ?? []).join(", ")}.`);
  }

  if (payload.status !== "saved") {
    throw new Error(payload.error || "Matter save returned an unexpected response.");
  }

  const savedMatter = payload.data ?? matterToSave;
  upsertCachedMatter(savedMatter);
  return savedMatter;
}

export function matterStatusMessage(status: MatterLoadStatus, count: number): string {
  if (status === "loading") return "Loading matters from Supabase.";
  if (status === "loaded") return `${count} matter record${count === 1 ? "" : "s"} loaded from Supabase.`;
  if (status === "empty") return "Supabase is configured and has zero saved matters.";
  if (status === "not_configured") return "Supabase matter storage is not configured for this deployment.";
  if (status === "cache") return `${count} cached matter record${count === 1 ? "" : "s"} shown from this browser because Supabase could not be reached.`;
  if (status === "error") return "Unable to load matters from Supabase.";
  return "";
}
