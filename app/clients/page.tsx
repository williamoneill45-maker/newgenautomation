"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { billingClientsStorageKey, billingInvoicesStorageKey, type BillingClientProfile, type StoredBillingInvoice } from "../../lib/billing-storage";
import { demoClient, demoMatter, isDemoEnvironment } from "../../lib/demo-data";
import { recentMattersStorageKey } from "../../lib/legal-aid";
import type { MatterFile } from "../../lib/matter";

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

export default function MattersPage() {
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const localClients = read<BillingClientProfile>(billingClientsStorageKey);
    const localMatters = read<MatterFile>(recentMattersStorageKey);
    setClients(localClients.length ? localClients : isDemoEnvironment ? [demoClient] : []);
    setMatters(localMatters.length ? localMatters : isDemoEnvironment ? [demoMatter] : []);
    setInvoices(read<StoredBillingInvoice>(billingInvoicesStorageKey));
    void fetch("/api/billing-clients")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.status === "loaded" && payload.clients?.length) setClients(payload.clients);
      })
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => clients.map((client) => {
    const matter = matters.find((item) => [item.clientName, item.intake.applicant.fullName].some((name) => name.toLowerCase() === client.clientName.toLowerCase()));
    const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id || invoice.clientName.toLowerCase() === client.clientName.toLowerCase());
    return { client, matter, invoices: clientInvoices.length };
  }).filter(({ client, matter }) => {
    const search = query.trim().toLowerCase();
    return !search || [client.clientName, client.legalAidNumber, matter?.intake.famNumber ?? "", matter?.intake.courtLocation ?? ""].some((value) => value.toLowerCase().includes(search));
  }), [clients, matters, invoices, query]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Matter workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Matters</h1>
            <p className="mt-2 text-sm text-slate-600">Find a matter and see its document, Legal Aid and billing position.</p>
          </div>
          <Link href="/new-client" className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700">Create New Matter</Link>
        </header>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold text-slate-950">All matters</h2>
            <label className="sr-only" htmlFor="matter-search">Search matters</label>
            <input id="matter-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, Legal Aid number, FAM number or court" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:max-w-md" />
          </div>
          <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[920px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Matter</th><th className="px-4 py-3">Legal Aid</th><th className="px-4 py-3">Court</th><th className="px-4 py-3">Proceedings</th><th className="px-4 py-3">Documents</th><th className="px-4 py-3">Billing</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(({ client, matter, invoices: invoiceCount }) => <tr key={client.id}>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-950">{client.clientName}</p><p className="mt-1 text-xs text-slate-500">{matter?.intake.famNumber || "FAM number not supplied"}</p></td>
                  <td className="px-4 py-3 text-slate-700">{client.legalAidNumber || "Not supplied"}</td>
                  <td className="px-4 py-3 text-slate-700">{matter?.intake.courtLocation || "Not selected"}</td>
                  <td className="px-4 py-3 text-slate-700">{matter?.intake.proceedingsType === "both" ? "Protection and Parenting" : matter?.intake.proceedingsType.replace(/_/g, " ") || "Not selected"}</td>
                  <td className="px-4 py-3"><Badge label={matter?.status === "documents_generated" ? "Generated" : "Ready for review"} tone={matter?.status === "documents_generated" ? "green" : "blue"} /></td>
                  <td className="px-4 py-3 text-slate-700">{invoiceCount} form{invoiceCount === 1 ? "" : "s"}</td>
                  <td className="px-4 py-3"><Link href={`/clients/${client.id}`} className="font-semibold text-sky-700 hover:text-sky-900">Open matter</Link></td>
                </tr>)}
                {!rows.length ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">No matters match this search.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Badge({ label, tone }: { label: string; tone: "green" | "blue" }) {
  return <span className={tone === "green" ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800"}>{label}</span>;
}
