"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  billingClientsStorageKey,
  billingInvoicesStorageKey,
  isInvoiceWithinRetention,
  type BillingClientProfile,
  type StoredBillingInvoice,
} from "../../../lib/billing-storage";
import {
  recentMattersStorageKey,
  type LegalAidRecord,
} from "../../../lib/legal-aid";
import type { MatterFile } from "../../../lib/matter";

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [legalAidRecords, setLegalAidRecords] = useState<LegalAidRecord[]>([]);

  useEffect(() => {
    setClients(readJsonArray<BillingClientProfile>(billingClientsStorageKey));
    setInvoices(readJsonArray<StoredBillingInvoice>(billingInvoicesStorageKey).filter(isInvoiceWithinRetention));
    setMatters(readJsonArray<MatterFile>(recentMattersStorageKey));

    fetch("/api/legal-aid-applications")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; data?: LegalAidRecord[] } | null) => {
        if (payload?.status === "loaded" && Array.isArray(payload.data)) {
          setLegalAidRecords(payload.data);
        }
      })
      .catch(() => undefined);
  }, []);

  const client = clients.find((item) => item.id === params.id) ?? null;
  const normalizedName = client?.clientName.toLowerCase() ?? "";
  const clientInvoices = useMemo(() =>
    invoices.filter((invoice) =>
      invoice.clientId === params.id || invoice.clientName.toLowerCase() === normalizedName,
    ),
  [invoices, normalizedName, params.id]);
  const clientMatters = useMemo(() =>
    matters.filter((matter) =>
      [matter.clientName, matter.intake.applicant.fullName].some((name) =>
        name.toLowerCase() === normalizedName,
      ),
    ),
  [matters, normalizedName]);
  const clientLegalAid = useMemo(() =>
    legalAidRecords.filter((record) => record.clientName.toLowerCase() === normalizedName),
  [legalAidRecords, normalizedName]);
  const totalBilled = clientInvoices.reduce((sum, invoice) => sum + invoice.invoiceTotal, 0);

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/clients" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to clients</Link>
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-8 shadow-form">
            <h1 className="text-2xl font-semibold text-slate-950">Client not found</h1>
            <p className="mt-2 text-sm text-slate-600">Create or save the client from intake or billing first.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/clients" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to clients</Link>

        <header className="mt-5 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Client profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{client.clientName}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Legal aid number: {client.legalAidNumber || "Not supplied"}
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Forms created" value={String(clientMatters.filter((matter) => matter.status === "documents_generated").length)} />
          <Metric label="Legal Aid" value={clientLegalAid[0]?.status?.replace(/_/g, " ") ?? "Not started"} />
          <Metric label="Bills" value={String(clientInvoices.length)} />
          <Metric label="Total billed" value={`$${totalBilled.toFixed(2)}`} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Proceedings status">
            {clientMatters.length ? (
              <div className="space-y-3">
                {clientMatters.map((matter) => (
                  <div key={matter.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-950">{matter.intake.courtLocation || "Court not selected"}</p>
                    <p className="mt-1 text-sm text-slate-600">{matter.intake.selectedApplications.join(", ") || "No applications selected"}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{matter.status.replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No saved intake found for this client yet.</p>
            )}
          </Panel>

          <Panel title="Legal Aid applications">
            {clientLegalAid.length ? (
              <div className="space-y-3">
                {clientLegalAid.map((record) => (
                  <div key={record.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-semibold text-slate-950">{record.status.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Income proof: {record.hasIncomeProof ? "received" : "pending"}; signed page: {record.hasSignedPage ? "received" : "pending"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No Legal Aid application linked yet.</p>
            )}
          </Panel>
        </section>

        <Panel title="Billing history" className="mt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {clientInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-700">Form {invoice.formType}</td>
                    <td className="px-4 py-3 text-slate-700">${invoice.invoiceTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-700">{invoice.missingEvidence?.join(", ") || "Complete"}</td>
                  </tr>
                ))}
                {!clientInvoices.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No invoices in the current 3 month window.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
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

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-form ${className}`}>
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
