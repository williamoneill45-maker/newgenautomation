"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { billingClientsStorageKey, billingInvoicesStorageKey, type BillingClientProfile, type StoredBillingInvoice } from "../../../lib/billing-storage";
import { demoClient, demoLegalAidApplications, demoMatter, isDemoEnvironment } from "../../../lib/demo-data";
import { recentMattersStorageKey, type LegalAidRecord } from "../../../lib/legal-aid";
import type { MatterFile } from "../../../lib/matter";

function read<T>(key: string): T[] {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T[] : []; } catch { return []; }
}

export default function MatterProfilePage() {
  const params = useParams<{ id: string }>();
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [legalAid, setLegalAid] = useState<LegalAidRecord[]>([]);

  useEffect(() => {
    const localClients = read<BillingClientProfile>(billingClientsStorageKey);
    const localMatters = read<MatterFile>(recentMattersStorageKey);
    setClients(localClients.length ? localClients : isDemoEnvironment ? [demoClient] : []);
    setMatters(localMatters.length ? localMatters : isDemoEnvironment ? [demoMatter] : []);
    setInvoices(read<StoredBillingInvoice>(billingInvoicesStorageKey));
    void fetch("/api/legal-aid-applications").then((response) => response.ok ? response.json() : null).then((payload) => {
      const records = payload?.status === "loaded" ? payload.data as LegalAidRecord[] : [];
      setLegalAid(records.length ? records : isDemoEnvironment ? demoLegalAidApplications : []);
    }).catch(() => setLegalAid(isDemoEnvironment ? demoLegalAidApplications : []));
  }, []);

  const client = clients.find((item) => item.id === params.id) ?? (isDemoEnvironment ? demoClient : null);
  const name = client?.clientName.toLowerCase() ?? "";
  const matter = matters.find((item) => [item.clientName, item.intake.applicant.fullName].some((value) => value.toLowerCase() === name)) ?? null;
  const clientInvoices = useMemo(() => invoices.filter((item) => item.clientId === params.id || item.clientName.toLowerCase() === name), [invoices, name, params.id]);
  const clientLegalAid = legalAid.filter((item) => item.clientName.toLowerCase() === name);
  const totalBilled = clientInvoices.reduce((sum, item) => sum + item.invoiceTotal, 0);

  if (!client) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-5xl"><Link href="/clients" className="text-sm font-semibold text-sky-700">Back to matters</Link><h1 className="mt-8 text-2xl font-semibold">Matter not found</h1></div></main>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/clients" className="text-sm font-semibold text-sky-700 hover:text-sky-900">Back to matters</Link>
        <header className="mt-5 flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Matter profile</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{client.clientName}</h1><p className="mt-2 text-sm text-slate-600">{matter?.intake.famNumber || "FAM number not supplied"} · Legal Aid {client.legalAidNumber || "not supplied"}</p></div>
          <div className="flex gap-3"><Link href="/legal-aid" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Open Legal Aid</Link><Link href="/billing" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Create billing form</Link></div>
        </header>
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Matter documents" value={matter?.status === "documents_generated" ? "Generated" : "Ready for review"} /><Metric label="Legal Aid" value={(clientLegalAid[0]?.status ?? "Not started").replace(/_/g, " ")} /><Metric label="Billing forms" value={String(clientInvoices.length)} /><Metric label="Total billed" value={`$${totalBilled.toFixed(2)}`} /></section>
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Matter details"><Definition label="Court" value={matter?.intake.courtLocation || "Not selected"} /><Definition label="Proceedings" value={matter?.intake.selectedApplications.join(", ") || "Not selected"} /><Definition label="Respondent" value={matter?.intake.respondent.fullName || "Not supplied"} /><Definition label="Children" value={matter?.intake.children.map((child) => child.fullName).join(", ") || "None recorded"} /></Panel>
          <Panel title="Current workflow"><Definition label="Matter documents" value={matter?.status.replace(/_/g, " ") || "Not started"} /><Definition label="Legal Aid" value={(clientLegalAid[0]?.status ?? "Not started").replace(/_/g, " ")} /><Definition label="MSD request" value={(client.msdRequestStatus ?? "not_started").replace(/_/g, " ")} /><Definition label="Storage" value={client.oneDriveClientFolderPath || "No storage action recorded"} /></Panel>
        </section>
        <Panel title="Billing history" className="mt-6"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Form</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200">{clientInvoices.map((invoice) => <tr key={invoice.id}><td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td><td className="px-4 py-3">Form {invoice.formType}</td><td className="px-4 py-3">${invoice.invoiceTotal.toFixed(2)}</td><td className="px-4 py-3 capitalize">{invoice.status.replace(/_/g, " ")}</td></tr>)}{!clientInvoices.length ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No billing forms recorded for this matter.</td></tr> : null}</tbody></table></div></Panel>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold capitalize text-slate-950">{value}</p></div>; }
function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) { return <section className={`rounded-lg border border-slate-200 bg-white p-5 shadow-form ${className}`}><h2 className="text-lg font-semibold text-slate-950">{title}</h2><div className="mt-4">{children}</div></section>; }
function Definition({ label, value }: { label: string; value: string }) { return <div className="border-b border-slate-100 py-3 first:pt-0 last:border-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm capitalize text-slate-800">{value}</p></div>; }
