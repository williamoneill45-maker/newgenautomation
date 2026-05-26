"use client";

import { useState } from "react";
import type { MatterFile } from "../lib/matter";
import { legalAidMatterStorageKey, recentMattersStorageKey } from "../lib/legal-aid";
import {
  billingClientsStorageKey,
  createBillingClientId,
  normalizeClientName,
  type BillingClientProfile,
} from "../lib/billing-storage";

function getSavedMatter(): MatterFile | null {
  const raw = window.localStorage.getItem(legalAidMatterStorageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MatterFile;
  } catch {
    return null;
  }
}

function readBillingClients(): BillingClientProfile[] {
  try {
    const raw = window.localStorage.getItem(billingClientsStorageKey);
    return raw ? (JSON.parse(raw) as BillingClientProfile[]) : [];
  } catch {
    window.localStorage.removeItem(billingClientsStorageKey);
    return [];
  }
}

function inferApplicationType(matter: MatterFile): BillingClientProfile["applicationType"] {
  const selectedApplications = matter.intake.selectedApplications.join(" ").toLowerCase();
  const hasParenting = selectedApplications.includes("parenting");
  const hasProtection = selectedApplications.includes("protection");

  if (hasParenting && hasProtection) return "both";
  if (hasParenting) return "parenting";
  if (hasProtection) return "protection";
  return "";
}

async function upsertClientForMatter(matter: MatterFile): Promise<BillingClientProfile> {
  const clientName = normalizeClientName(matter.intake.applicant.fullName || matter.clientName);

  if (!clientName) {
    throw new Error("Save the client or applicant name before starting induction.");
  }

  const now = new Date().toISOString();
  const clients = readBillingClients();
  const existingClient = clients.find((client) =>
    client.clientName.toLowerCase() === clientName.toLowerCase(),
  );
  const profile: BillingClientProfile = existingClient
    ? {
        ...existingClient,
        clientName,
        legalAidNumber: matter.legalAidNumber,
        famNumber: matter.intake.famNumber,
        clientEmail: matter.intake.applicant.emailAddress,
        applicationType: existingClient.applicationType || inferApplicationType(matter),
        updatedAt: now,
      }
    : {
        id: createBillingClientId(`${clientName}-${matter.id}`),
        clientName,
        legalAidNumber: matter.legalAidNumber,
        famNumber: matter.intake.famNumber,
        clientEmail: matter.intake.applicant.emailAddress,
        applicationType: inferApplicationType(matter),
        createdAt: now,
        updatedAt: now,
      };
  const nextClients = existingClient
    ? clients.map((client) => (client.id === existingClient.id ? profile : client))
    : [profile, ...clients];

  window.localStorage.setItem(billingClientsStorageKey, JSON.stringify(nextClients));

  await fetch("/api/billing-clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });

  return profile;
}

function markMatterDocumentsGenerated(matter: MatterFile) {
  const generatedMatter: MatterFile = {
    ...matter,
    status: "documents_generated",
    updatedAt: new Date().toISOString(),
  };
  const existingRaw = window.localStorage.getItem(recentMattersStorageKey);
  const existing = existingRaw ? (JSON.parse(existingRaw) as MatterFile[]) : [];

  window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(generatedMatter));
  window.localStorage.setItem(
    recentMattersStorageKey,
    JSON.stringify([generatedMatter, ...existing.filter((item) => item.id !== matter.id)].slice(0, 25)),
  );
}

export default function DocumentDownloadPanel() {
  const [status, setStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const generateDocuments = async () => {
    const matter = getSavedMatter();

    if (!matter) {
      setStatus("Save the intake first, then generate documents.");
      return;
    }

    setIsGenerating(true);
    setStatus("");

    try {
      const response = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matter, uploadToOneDrive: false }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error || "Document generation failed");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileNameMatch?.[1] ?? `${matter.clientName || matter.intake.applicant.fullName || "Client"}_Forms.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      markMatterDocumentsGenerated(matter);
      setStatus("Documents downloaded to this computer.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Documents could not be generated.");
    } finally {
      setIsGenerating(false);
    }
  };

  const uploadToOneDriveAndStartInduction = async () => {
    const matter = getSavedMatter();

    if (!matter) {
      setStatus("Save the intake first, then upload to OneDrive.");
      return;
    }

    const clientEmail = matter.intake.applicant.emailAddress.trim();
    const applicationType = inferApplicationType(matter);

    if (!matter.legalAidNumber.trim()) {
      setStatus("Add the Legal Aid Number before uploading to OneDrive.");
      return;
    }

    if (!clientEmail) {
      setStatus("Add the applicant email address before starting induction.");
      return;
    }

    if (!applicationType) {
      setStatus("Select a protection or parenting application before starting induction.");
      return;
    }

    setIsUploading(true);
    setStatus("");

    try {
      const client = await upsertClientForMatter(matter);
      const inductionResponse = await fetch("/api/clients/start-induction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            ...client,
            clientEmail,
            applicationType,
          },
          clientEmail,
          applicationType,
        }),
      });
      const inductionPayload = (await inductionResponse.json().catch(() => null)) as {
        error?: string;
        client?: BillingClientProfile;
        instructions?: { path?: string };
      } | null;

      if (!inductionResponse.ok) {
        throw new Error(inductionPayload?.error || "Induction setup failed.");
      }

      if (inductionPayload?.client) {
        const clients = readBillingClients();
        const nextClients = clients.some((item) => item.id === inductionPayload.client?.id)
          ? clients.map((item) => (item.id === inductionPayload.client?.id ? inductionPayload.client : item))
          : [inductionPayload.client, ...clients];
        window.localStorage.setItem(billingClientsStorageKey, JSON.stringify(nextClients));
      }

      const documentResponse = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matter,
          uploadToOneDrive: true,
          responseMode: "json",
        }),
      });
      const documentPayload = (await documentResponse.json().catch(() => null)) as {
        error?: string;
        oneDrivePath?: string;
        uploadedDocuments?: Array<{ fileName: string }>;
        automationTriggerPath?: string;
      } | null;

      if (!documentResponse.ok) {
        throw new Error(documentPayload?.error || "Generated documents could not be uploaded to OneDrive.");
      }

      markMatterDocumentsGenerated(matter);
      setStatus([
        `Client folder ready: ${documentPayload?.oneDrivePath ?? "OneDrive client folder"}.`,
        `${documentPayload?.uploadedDocuments?.length ?? 0} generated files uploaded.`,
        inductionPayload?.instructions?.path ? `Instructions file: ${inductionPayload.instructions.path}.` : "",
        documentPayload?.automationTriggerPath ? `Automation trigger: ${documentPayload.automationTriggerPath}.` : "",
      ].filter(Boolean).join(" "));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "OneDrive upload and induction could not be completed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-form">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Document Bundle</h2>
          <p className="mt-1 text-sm text-slate-600">
            Save intake first. Download keeps files local; OneDrive upload also starts induction automation.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={generateDocuments}
            disabled={isGenerating || isUploading}
            className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isGenerating ? "Generating..." : "Download to computer"}
          </button>
          <button
            type="button"
            onClick={uploadToOneDriveAndStartInduction}
            disabled={isGenerating || isUploading}
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isUploading ? "Uploading..." : "Upload to OneDrive + induction"}
          </button>
        </div>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
