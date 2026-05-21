"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  billingInvoicesStorageKey,
  isInvoiceWithinRetention,
  type StoredBillingInvoice,
} from "../../lib/billing-storage";

function readInvoices(): StoredBillingInvoice[] {
  try {
    const raw = window.localStorage.getItem(billingInvoicesStorageKey);
    return raw ? (JSON.parse(raw) as StoredBillingInvoice[]).filter(isInvoiceWithinRetention) : [];
  } catch {
    window.localStorage.removeItem(billingInvoicesStorageKey);
    return [];
  }
}

function getInvoiceTimestamp(invoice: StoredBillingInvoice): number {
  const timestamp = new Date(invoice.generatedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeInvoices(
  localInvoices: StoredBillingInvoice[],
  supabaseInvoices: StoredBillingInvoice[],
): StoredBillingInvoice[] {
  const merged = new Map<string, StoredBillingInvoice>();

  for (const invoice of localInvoices.filter(isInvoiceWithinRetention)) {
    merged.set(invoice.id, invoice);
  }

  for (const invoice of supabaseInvoices.filter(isInvoiceWithinRetention)) {
    const existing = merged.get(invoice.id);
    if (!existing || getInvoiceTimestamp(invoice) >= getInvoiceTimestamp(existing)) {
      merged.set(invoice.id, invoice);
    }
  }

  return [...merged.values()].sort((a, b) => getInvoiceTimestamp(b) - getInvoiceTimestamp(a));
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("Browser storage");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const localInvoices = readInvoices();
    setInvoices(localInvoices);

    fetch("/api/billing-records")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Supabase invoice register.");
        return response.json() as Promise<
          | { status: "loaded"; invoices: StoredBillingInvoice[] }
          | { status: "not_configured"; missing: string[] }
        >;
      })
      .then((payload) => {
        if (payload.status === "loaded") {
          const mergedInvoices = mergeInvoices(localInvoices, payload.invoices);
          setInvoices(mergedInvoices);
          window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(mergedInvoices));
          setSource("Browser storage + Supabase");
          return;
        }

        setSource(`Browser storage; Supabase missing ${payload.missing.join(", ")}`);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Unable to load Supabase invoice register.");
      });
  }, []);

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return invoices;

    return invoices.filter((invoice) =>
      [
        invoice.clientName,
        invoice.legalAidNumber,
        invoice.invoiceNumber,
        invoice.formType,
        invoice.status,
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [invoices, query]);

  const totalBilled = filteredInvoices.reduce((sum, invoice) => sum + invoice.invoiceTotal, 0);
  const uploadedCount = filteredInvoices.filter((invoice) => invoice.status === "onedrive_uploaded").length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to dashboard
          </Link>
          <Link href="/billing" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
            New billing invoice
          </Link>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing register</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Invoices</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Track generated and pending invoices for the current 3 month billing window.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-700">Data source: {source}</p>
          {loadError ? <p className="mt-2 text-sm font-medium text-amber-700">{loadError}</p> : null}
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <SummaryCard label="Invoices" value={String(filteredInvoices.length)} />
          <SummaryCard label="Total billed" value={`$${totalBilled.toFixed(2)}`} />
          <SummaryCard label="OneDrive uploaded" value={`${uploadedCount}/${filteredInvoices.length}`} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold text-slate-950">Invoice history</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, invoice number, legal aid number, status"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:max-w-sm"
            />
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Legal aid</th>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">OneDrive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      <Link href={`/invoices/${invoice.id}`} className="text-sky-700 hover:text-sky-900">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{invoice.clientName}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.legalAidNumber}</td>
                    <td className="px-4 py-3 text-slate-700">Form {invoice.formType}</td>
                    <td className="px-4 py-3 text-slate-700">${invoice.invoiceTotal.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={invoice.status === "onedrive_uploaded"
                        ? "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900"
                        : "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900"}
                      >
                        {invoice.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {(invoice.missingEvidence ?? []).length
                        ? invoice.missingEvidence?.join(", ")
                        : "Complete"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {invoice.oneDriveUrl ? (
                        <a className="font-medium text-sky-700 hover:text-sky-900" href={invoice.oneDriveUrl}>
                          Open
                        </a>
                      ) : (
                        invoice.oneDrivePath || "Pending configuration"
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredInvoices.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      No invoices have been generated yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
