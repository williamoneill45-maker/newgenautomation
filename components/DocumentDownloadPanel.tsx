"use client";

import { useEffect, useState } from "react";

import { demoMatter, isDemoEnvironment } from "../lib/demo-data";
import { legalAidMatterStorageKey, recentMattersStorageKey } from "../lib/legal-aid";
import { normalizeProceedingsType, type MatterFile } from "../lib/matter";

type BundleStatus = "Generated" | "Not Required" | "Awaiting Requirements";

function getSavedMatter(): MatterFile | null {
  const raw = window.localStorage.getItem(legalAidMatterStorageKey);
  if (!raw) return isDemoEnvironment ? demoMatter : null;
  try {
    return JSON.parse(raw) as MatterFile;
  } catch {
    return isDemoEnvironment ? demoMatter : null;
  }
}

function markMatterDocumentsGenerated(matter: MatterFile) {
  const generatedMatter: MatterFile = { ...matter, status: "documents_generated", updatedAt: new Date().toISOString() };
  const existingRaw = window.localStorage.getItem(recentMattersStorageKey);
  const existing = existingRaw ? (JSON.parse(existingRaw) as MatterFile[]) : [];
  window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(generatedMatter));
  window.localStorage.setItem(recentMattersStorageKey, JSON.stringify([generatedMatter, ...existing.filter((item) => item.id !== matter.id)].slice(0, 25)));
  window.dispatchEvent(new CustomEvent("newgen:matter-saved"));
}

function bundleStatus(required: boolean, generated: boolean): BundleStatus {
  if (!required) return "Not Required";
  return generated ? "Generated" : "Awaiting Requirements";
}

export default function DocumentDownloadPanel() {
  const [matter, setMatter] = useState<MatterFile | null>(null);
  const [status, setStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [oneDriveConfigured, setOneDriveConfigured] = useState(false);

  useEffect(() => {
    const refresh = () => setMatter(getSavedMatter());
    refresh();
    window.addEventListener("newgen:matter-saved", refresh);
    void fetch("/api/onedrive-status")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setOneDriveConfigured(Boolean(payload?.configured)))
      .catch(() => setOneDriveConfigured(false));
    return () => window.removeEventListener("newgen:matter-saved", refresh);
  }, []);

  const proceedingsType = normalizeProceedingsType(matter?.intake.proceedingsType ?? "");
  const protection = proceedingsType === "protection_order" || proceedingsType === "both";
  const parenting = proceedingsType === "care_of_children" || proceedingsType === "both";
  const generated = matter?.status === "documents_generated";
  const items: Array<{ label: string; status: BundleStatus }> = [
    { label: "Information Sheet", status: bundleStatus(Boolean(matter), generated) },
    { label: "Confidential Address application", status: bundleStatus(Boolean(matter?.intake.applicant.isAddressConfidential), generated) },
    { label: "Parenting Order application", status: bundleStatus(parenting, generated) },
    { label: "Protection Order application", status: bundleStatus(protection, generated) },
    { label: "MSD Request", status: bundleStatus(Boolean(matter), generated) },
    { label: "Police Information Sheet", status: bundleStatus(Boolean(matter), generated) },
    { label: "Lawyer Certificate", status: bundleStatus(Boolean(matter), generated) },
    { label: "Family Violence Affidavit", status: bundleStatus(protection, generated) },
    { label: "Ltr to Court Confirming Legal Aid", status: bundleStatus(Boolean(matter), generated) },
    { label: "Ltr to Court Filing Docs", status: bundleStatus(Boolean(matter), generated) },
    { label: "Ltr to Court Filing DV Applications", status: bundleStatus(Boolean(matter), generated) },
    { label: "Ltr to MFI", status: bundleStatus(Boolean(matter), generated) },
    { label: "Police Email", status: bundleStatus(Boolean(matter), generated) },
    { label: "Registrar List Submissions", status: bundleStatus(Boolean(matter), generated) },
    { label: "Confidential Address Applicant Information Sheet", status: bundleStatus(Boolean(matter), generated) },
    { label: "Legal Aid Application", status: "Awaiting Requirements" },
    { label: "Billing forms", status: "Awaiting Requirements" },
  ];

  async function generateDocuments(uploadToOneDrive: boolean) {
    const savedMatter = getSavedMatter();
    if (!savedMatter) {
      setStatus("Save the matter intake before generating documents.");
      return;
    }
    uploadToOneDrive ? setIsUploading(true) : setIsGenerating(true);
    setStatus("");
    try {
      const response = await fetch("/api/generate-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matter: savedMatter, uploadToOneDrive, responseMode: uploadToOneDrive ? "json" : "zip" }),
      });
      if (uploadToOneDrive) {
        const payload = await response.json() as { error?: string; oneDrivePath?: string; uploadedDocuments?: Array<{ fileName: string }> };
        if (!response.ok) throw new Error(payload.error || "Documents could not be saved to OneDrive.");
        markMatterDocumentsGenerated(savedMatter);
        setMatter({ ...savedMatter, status: "documents_generated" });
        setStatus(`${payload.uploadedDocuments?.length ?? 0} documents saved to ${payload.oneDrivePath || "OneDrive"}.`);
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Document generation failed.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? "Matter_Documents.zip";
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      markMatterDocumentsGenerated(savedMatter);
      setMatter({ ...savedMatter, status: "documents_generated" });
      setStatus("Matter documents downloaded to this computer.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Documents could not be generated.");
    } finally {
      setIsGenerating(false);
      setIsUploading(false);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Matter documents</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Generated Matter Bundle</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review what belongs in this matter, then download it or choose a configured storage provider. Storage is always a separate action.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void generateDocuments(false)} disabled={isGenerating || isUploading} className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50">
            {isGenerating ? "Generating…" : "Download to computer"}
          </button>
          {oneDriveConfigured ? (
            <button type="button" onClick={() => void generateDocuments(true)} disabled={isGenerating || isUploading} className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50">
              {isUploading ? "Saving…" : "Save to OneDrive"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
        <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Bundle item</span><span>Status</span></div>
        {items.map((item) => <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-slate-200 px-4 py-3"><span className="text-sm font-medium text-slate-800">{item.label}</span><StatusBadge status={item.status} /></div>)}
      </div>
      {status ? <p role="status" className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}

function StatusBadge({ status }: { status: BundleStatus }) {
  const style = status === "Generated" ? "bg-emerald-100 text-emerald-800" : status === "Not Required" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-900";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status}</span>;
}
