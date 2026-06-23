"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { billingInvoicesStorageKey, type StoredBillingInvoice } from "../lib/billing-storage";
import { demoClaims, demoLegalAidApplications, demoMatter, isDemoEnvironment } from "../lib/demo-data";
import type { LegalAidClaim } from "../lib/legal-aid-claims";
import { recentMattersStorageKey, type LegalAidRecord } from "../lib/legal-aid";
import type { MatterFile } from "../lib/matter";

type QueueCard = { label: string; count: number; tone?: "warning" | "ready" };

function readLocal<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

function overdue(claim: LegalAidClaim): boolean {
  if (!claim.dateSent || claim.outstandingAmount <= 0 || claim.lifecycleStatus === "Paid") return false;
  const age = Date.now() - new Date(`${claim.dateSent}T00:00:00+12:00`).getTime();
  return age > 14 * 24 * 60 * 60 * 1000;
}

export default function Dashboard() {
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [legalAid, setLegalAid] = useState<LegalAidRecord[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [claims, setClaims] = useState<LegalAidClaim[]>([]);

  useEffect(() => {
    const loadedMatters = readLocal<MatterFile>(recentMattersStorageKey);
    setMatters(loadedMatters.length ? loadedMatters : isDemoEnvironment ? [demoMatter] : []);
    setInvoices(readLocal<StoredBillingInvoice>(billingInvoicesStorageKey));

    void Promise.all([
      fetch("/api/legal-aid-applications", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      fetch("/api/legal-aid-claims", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
    ]).then(([legalAidPayload, claimsPayload]) => {
      const loadedLegalAid = legalAidPayload?.status === "loaded" ? legalAidPayload.data as LegalAidRecord[] : [];
      const loadedClaims = claimsPayload?.status === "loaded" ? claimsPayload.data as LegalAidClaim[] : [];
      setLegalAid(loadedLegalAid.length ? loadedLegalAid : isDemoEnvironment ? demoLegalAidApplications : []);
      setClaims(loadedClaims.length ? loadedClaims : isDemoEnvironment ? demoClaims : []);
    });
  }, []);

  const legalAidQueue = useMemo<QueueCard[]>(() => [
    { label: "Missing income proof", count: legalAid.filter((item) => !item.hasIncomeProof).length, tone: "warning" },
    { label: "Missing signed page 5", count: legalAid.filter((item) => item.hasIncomeProof && !item.hasSignedPage).length, tone: "warning" },
    { label: "Ready", count: legalAid.filter((item) => item.status === "ready_to_generate").length, tone: "ready" },
    { label: "Generated", count: legalAid.filter((item) => item.status === "generated").length },
    { label: "Submitted", count: legalAid.filter((item) => item.status === "submitted").length },
  ], [legalAid]);

  const billingQueue = useMemo<QueueCard[]>(() => [
    { label: "Draft", count: invoices.filter((item) => item.status === "ready_to_generate").length },
    { label: "Generated", count: claims.filter((item) => item.lifecycleStatus === "Generated").length },
    { label: "Sent", count: claims.filter((item) => item.lifecycleStatus === "Sent" && !overdue(item)).length },
    { label: "Paid", count: claims.filter((item) => item.lifecycleStatus === "Paid").length, tone: "ready" },
    { label: "Overdue", count: claims.filter(overdue).length, tone: "warning" },
  ], [claims, invoices]);

  const actions = [
    { label: "Missing evidence", count: legalAid.filter((item) => !item.hasIncomeProof || !item.hasSignedPage).length, href: "/legal-aid" },
    { label: "Applications ready to generate", count: legalAid.filter((item) => item.status === "ready_to_generate").length, href: "/legal-aid" },
    { label: "Claims ready to send", count: claims.filter((item) => item.lifecycleStatus === "Generated").length, href: "/billing/claims" },
    { label: "Unpaid claims requiring follow-up", count: claims.filter((item) => overdue(item) || (item.amountPaid > 0 && item.outstandingAmount > 0)).length, href: "/billing/claims" },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-7 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Matter workflow</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Move each matter from intake through documents, Legal Aid, billing, claims and storage.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <SecondaryLink href="/legal-aid">Legal Aid</SecondaryLink>
            <SecondaryLink href="/billing">Billing</SecondaryLink>
            <SecondaryLink href="/billing/claims">Claims Tracker</SecondaryLink>
            <Link href="/new-client" className="inline-flex h-11 items-center justify-center rounded-md bg-sky-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
              Create New Matter
            </Link>
          </div>
        </header>

        <section className="mt-7 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Action Required</h2>
              <p className="mt-1 text-sm text-slate-600">Items that need a lawyer or staff member to move them forward.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{actions.reduce((sum, item) => sum + item.count, 0)} open</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {actions.map((action) => (
              <Link key={action.label} href={action.href} className="rounded-md border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <span className="text-2xl font-semibold text-slate-950">{action.count}</span>
                <span className="mt-2 block text-sm font-medium text-slate-700">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Queue title="Legal Aid queue" href="/legal-aid" items={legalAidQueue} />
          <Queue title="Billing and claims queue" href="/billing/claims" items={billingQueue} />
        </div>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Workflow at a glance</h2>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {["Intake", "Matter documents", "Legal Aid", "Billing", "Claims", "Storage"].map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span>
                <span className="text-sm font-medium text-slate-800">{step}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">{matters.length} matter record{matters.length === 1 ? "" : "s"} currently saved in this workspace.</p>
        </section>
      </div>
    </main>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">{children}</Link>;
}

function Queue({ title, href, items }: { title: string; href: string; items: QueueCard[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-sky-700 hover:text-sky-900">Open queue</Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className={item.tone === "warning" ? "rounded-md border border-amber-200 bg-amber-50 p-3" : item.tone === "ready" ? "rounded-md border border-emerald-200 bg-emerald-50 p-3" : "rounded-md border border-slate-200 bg-slate-50 p-3"}>
            <p className="text-xl font-semibold text-slate-950">{item.count}</p>
            <p className="mt-1 text-xs font-medium leading-4 text-slate-600">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
