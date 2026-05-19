"use client";

import { useState } from "react";
import type { MatterFile } from "../lib/matter";

function getSavedMatter(): MatterFile | null {
  const raw = window.localStorage.getItem("newgenautomation:draftMatter");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as MatterFile;
  } catch {
    return null;
  }
}

export default function DocumentDownloadPanel() {
  const [status, setStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
        body: JSON.stringify({ matter }),
      });

      if (!response.ok) {
        throw new Error("Document generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "family-court-documents.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setStatus("Documents downloaded.");
    } catch {
      setStatus("Documents could not be generated.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-form">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Document Bundle</h2>
          <p className="mt-1 text-sm text-slate-600">
            Save intake before downloading. The bundle includes a template validation report.
          </p>
        </div>
        <button
          type="button"
          onClick={generateDocuments}
          disabled={isGenerating}
          className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isGenerating ? "Generating..." : "Download generated documents"}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </section>
  );
}
