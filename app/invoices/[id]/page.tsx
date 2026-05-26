"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  billingInvoicesStorageKey,
  isInvoiceWithinRetention,
type StoredBillingInvoice,
} from "../../../lib/billing-storage";

type EvidenceUploadPayload =
  | { status: "uploaded"; invoice: StoredBillingInvoice }
  | { status: "not_configured"; missing: string[] }
  | { error: string };

function readInvoices(): StoredBillingInvoice[] {
  try {
    const raw = window.localStorage.getItem(billingInvoicesStorageKey);
    return raw ? (JSON.parse(raw) as StoredBillingInvoice[]).filter(isInvoiceWithinRetention) : [];
  } catch {
    window.localStorage.removeItem(billingInvoicesStorageKey);
    return [];
  }
}

function saveInvoices(invoices: StoredBillingInvoice[]) {
  window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(invoices));
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const localInvoices = readInvoices();
    setInvoices(localInvoices);

    fetch("/api/billing-records")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; invoices?: StoredBillingInvoice[] } | null) => {
        if (payload?.status !== "loaded" || !Array.isArray(payload.invoices)) return;
        const merged = new Map(localInvoices.map((invoice) => [invoice.id, invoice]));
        for (const invoice of payload.invoices.filter(isInvoiceWithinRetention)) {
          merged.set(invoice.id, { ...merged.get(invoice.id), ...invoice });
        }
        const nextInvoices = [...merged.values()];
        setInvoices(nextInvoices);
        saveInvoices(nextInvoices);
      })
      .catch(() => undefined);
  }, []);

  const invoice = useMemo(() =>
    invoices.find((item) => item.id === params.id) ?? null,
  [invoices, params.id]);

  async function uploadEvidence(label: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !invoice) return;

    setUploadingLabel(label);
    setNotice("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("evidenceLabel", label);
      formData.append("invoice", JSON.stringify(invoice));

      const response = await fetch(`/api/billing-records/${invoice.id}/evidence`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json() as EvidenceUploadPayload;

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error ?? "Evidence upload failed." : "Evidence upload failed.");
      }

      if ("error" in payload) {
        throw new Error(payload.error ?? "Evidence upload failed.");
      }

      if (payload.status === "not_configured") {
        throw new Error(`Supabase missing ${payload.missing.join(", ")}.`);
      }

      const nextInvoices = [
        payload.invoice,
        ...invoices.filter((item) => item.id !== payload.invoice.id),
      ];
      setInvoices(nextInvoices);
      saveInvoices(nextInvoices);
      setNotice("Evidence uploaded and invoice status updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Evidence upload failed.");
    } finally {
      setUploadingLabel("");
      event.target.value = "";
    }
  }

  async function generateStoredInvoice() {
    if (!invoice?.billingRecord) {
      setError("No billing draft snapshot is stored for this invoice, so regenerate it from the Billing Workbench.");
      return;
    }

    if ((invoice.missingEvidence ?? []).length) {
      setError("Upload the missing evidence before generating this invoice.");
      return;
    }

    setIsGenerating(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/generate-billing-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record: invoice.billingRecord, reviewed: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to generate billing document.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? `${invoice.invoiceNumber}.docx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const nextInvoice: StoredBillingInvoice = {
        ...invoice,
        status: "onedrive_pending",
        generatedFileName: fileName,
        oneDrivePath: `NewGenAutomation/Clients/${invoice.clientName} - ${invoice.legalAidNumber}/Billing/${fileName}`,
        generatedAt: new Date().toISOString(),
      };
      const nextInvoices = [
        nextInvoice,
        ...invoices.filter((item) => item.id !== nextInvoice.id),
      ];
      setInvoices(nextInvoices);
      saveInvoices(nextInvoices);
      await fetch("/api/billing-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextInvoice),
      });
      setNotice("Invoice generated and metadata updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to generate billing document.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!invoice) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/invoices" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to invoices</Link>
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-8 shadow-form">
            <h1 className="text-2xl font-semibold text-slate-950">Invoice not found</h1>
            <p className="mt-2 text-sm text-slate-600">The invoice may not be in the current 3 month register.</p>
          </section>
        </div>
      </main>
    );
  }

  const missingEvidence = invoice.missingEvidence ?? [];
  const uploadedEvidence = invoice.evidenceFiles ?? [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/invoices" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to invoices</Link>

        <header className="mt-5 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Invoice detail</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{invoice.invoiceNumber}</h1>
          <p className="mt-2 text-sm text-slate-600">{invoice.clientName} | Form {invoice.formType}</p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Total" value={`$${invoice.invoiceTotal.toFixed(2)}`} />
          <Metric label="Status" value={invoice.status.replace(/_/g, " ")} />
          <Metric label="Legal aid" value={invoice.legalAidNumber || "Not supplied"} />
          <Metric label="Evidence" value={missingEvidence.length ? `${missingEvidence.length} missing` : "Complete"} />
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Evidence</h2>
          {missingEvidence.length ? (
            <div className="mt-4 space-y-3">
              {missingEvidence.map((label) => (
                <label key={label} className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-amber-950">{label}</span>
                  <span className="inline-flex">
                    <input
                      type="file"
                      className="block max-w-xs text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                      disabled={uploadingLabel === label}
                      onChange={(event) => uploadEvidence(label, event)}
                    />
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">All required billing evidence has been uploaded or marked complete.</p>
          )}
          {uploadedEvidence.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-950">Uploaded files</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {uploadedEvidence.map((file) => (
                  <li key={file.storagePath}>{file.label}: {file.fileName}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {notice ? <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Generate</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pending invoices can be generated from the stored draft once evidence is complete.
          </p>
          <button
            type="button"
            disabled={isGenerating || missingEvidence.length > 0 || !invoice.billingRecord}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={generateStoredInvoice}
          >
            {isGenerating ? "Generating..." : "Generate invoice document"}
          </button>
          {!invoice.billingRecord ? (
            <p className="mt-2 text-sm text-amber-700">This older invoice has no stored draft snapshot. Regenerate it from the Billing Workbench if needed.</p>
          ) : null}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Billing wording</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {invoice.billingRecord?.draft.standardWording || "No wording snapshot was stored for this invoice."}
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold capitalize text-slate-950">{value}</p>
    </div>
  );
}
