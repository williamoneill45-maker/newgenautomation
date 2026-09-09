"use client";

import { useState } from "react";

type Placeholder = {
  raw: string;
  key: string;
  canonicalKey?: string;
  status: "known" | "legacy" | "unknown" | "malformed";
  issue?: string;
};

type ScanResponse = {
  fileName: string;
  placeholders: Placeholder[];
  summary: {
    known: number;
    legacy: number;
    unknown: number;
    malformed: number;
    blocked: boolean;
  };
};

export function TemplateUploadScanner() {
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  async function handleFile(file: File | undefined) {
    setError("");
    setScan(null);

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Choose a DOCX file. Legacy .doc files need to be converted first.");
      return;
    }

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/templates/scan-upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to scan template.");
        return;
      }

      setScan(payload);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to scan template.");
    } finally {
      setIsScanning(false);
    }
  }

  const issuePlaceholders = scan?.placeholders.filter((placeholder) => placeholder.status !== "known") ?? [];

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Scan A New Template</h2>
          <p className="mt-1 text-sm text-slate-600">Check placeholders before replacing an active template.</p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50">
          {isScanning ? "Scanning..." : "Choose DOCX"}
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900">
          {error}
        </div>
      ) : null}

      {scan ? (
        <div className="mt-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-slate-950">{scan.fileName}</p>
              <p className="mt-1 text-sm text-slate-600">
                {scan.summary.blocked ? "Fix unknown or malformed placeholders before upload." : "No blocker found."}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <Count label="Known" value={scan.summary.known} />
              <Count label="Legacy" value={scan.summary.legacy} />
              <Count label="Unknown" value={scan.summary.unknown} />
              <Count label="Malformed" value={scan.summary.malformed} />
            </div>
          </div>

          {issuePlaceholders.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Placeholder</th>
                    <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Status</th>
                    <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Use instead</th>
                    <th className="border-b border-slate-200 py-2 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {issuePlaceholders.map((placeholder) => (
                    <tr key={`${placeholder.raw}-${placeholder.status}`} className="align-top">
                      <td className="border-b border-slate-100 py-3 pr-4">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{placeholder.raw}</code>
                      </td>
                      <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{placeholder.status}</td>
                      <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                        {placeholder.canonicalKey ? (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{`{{${placeholder.canonicalKey}}}`}</code>
                        ) : "Check field dictionary"}
                      </td>
                      <td className="border-b border-slate-100 py-3 text-slate-700">{placeholder.issue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
