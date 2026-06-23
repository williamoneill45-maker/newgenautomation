"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { demoClaims, isDemoEnvironment } from "../../../lib/demo-data";
import { claimIsOverdue, derivePayment, type LegalAidClaim, type LegalAidClaimLifecycle } from "../../../lib/legal-aid-claims";

type EditableClaim = LegalAidClaim & { saving?: boolean; error?: string };
const currency = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" });
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
const lifecycleOptions: LegalAidClaimLifecycle[] = ["Draft", "Generated", "Sent", "Paid"];

function isThisWeek(date: string): boolean {
  if (!date) return false;
  const value = new Date(`${date}T00:00:00+12:00`);
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return value >= monday;
}

function isThisMonth(date: string): boolean { return Boolean(date && date.slice(0, 7) === today.slice(0, 7)); }

export default function ClaimsPage() {
  const [claims, setClaims] = useState<EditableClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<"All" | LegalAidClaimLifecycle>("All");

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/legal-aid-claims", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load claims.");
      const loaded = payload.status === "loaded" ? payload.data as LegalAidClaim[] : [];
      if (!loaded.length && isDemoEnvironment) setClaims(demoClaims);
      else if (payload.status === "not_configured") throw new Error(`Claims database is not configured: ${payload.missing.join(", ")}.`);
      else setClaims(loaded);
    } catch (error) {
      if (isDemoEnvironment) setClaims(demoClaims);
      else setPageError(error instanceof Error ? error.message : "Unable to load claims.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadClaims(); }, [loadClaims]);

  const filteredClaims = useMemo(() => claims.filter((claim) => {
    const text = [claim.claimId, claim.clientName, claim.legalAidNumber, claim.matterName].join(" ").toLowerCase();
    const searchMatches = text.includes(search.trim().toLowerCase());
    const dateMatches = (!dateFrom || claim.dateSent >= dateFrom) && (!dateTo || claim.dateSent <= dateTo);
    return searchMatches && dateMatches && (status === "All" || claim.lifecycleStatus === status);
  }), [claims, search, dateFrom, dateTo, status]);

  const followUp = claims.filter((claim) => claimIsOverdue(claim) || (claim.paidStatus === "Part Paid" && claim.outstandingAmount > 0));
  const totals = {
    claimedWeek: claims.filter((claim) => isThisWeek(claim.dateGenerated)).reduce((sum, claim) => sum + claim.amountClaimed, 0),
    claimedMonth: claims.filter((claim) => isThisMonth(claim.dateGenerated)).reduce((sum, claim) => sum + claim.amountClaimed, 0),
    paidWeek: claims.filter((claim) => isThisWeek(claim.datePaid)).reduce((sum, claim) => sum + claim.amountPaid, 0),
    paidMonth: claims.filter((claim) => isThisMonth(claim.datePaid)).reduce((sum, claim) => sum + claim.amountPaid, 0),
    outstanding: claims.reduce((sum, claim) => sum + claim.outstandingAmount, 0),
    overdue: claims.filter((claim) => claimIsOverdue(claim)).reduce((sum, claim) => sum + claim.outstandingAmount, 0),
  };

  function editClaim(id: string, changes: Partial<EditableClaim>) {
    setClaims((current) => current.map((claim) => {
      if (claim.id !== id) return claim;
      const next = { ...claim, ...changes, error: "" };
      if (changes.amountPaid !== undefined) {
        const payment = derivePayment(next.amountClaimed, changes.amountPaid);
        next.paidStatus = payment.paidStatus;
        next.outstandingAmount = payment.outstandingAmount;
        if (payment.paidStatus === "Paid") next.lifecycleStatus = "Paid";
      }
      return next;
    }));
  }

  async function saveClaim(claim: EditableClaim, markPaid = false) {
    editClaim(claim.id, { saving: true });
    if (isDemoEnvironment && claim.firmId === "demo-firm") {
      const payment = derivePayment(claim.amountClaimed, markPaid ? claim.amountClaimed : claim.amountPaid);
      editClaim(claim.id, { saving: false, amountPaid: markPaid ? claim.amountClaimed : claim.amountPaid, paidStatus: payment.paidStatus, outstandingAmount: payment.outstandingAmount, lifecycleStatus: markPaid ? "Paid" : claim.lifecycleStatus, datePaid: markPaid ? claim.datePaid || today : claim.datePaid });
      return;
    }
    try {
      const response = await fetch("/api/legal-aid-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claim.id, lifecycleStatus: claim.lifecycleStatus, markPaid, amountPaid: markPaid ? claim.amountClaimed : claim.amountPaid, dateSent: claim.dateSent, datePaid: markPaid ? claim.datePaid || today : claim.datePaid, storageProvider: claim.storageProvider, storageLocation: claim.storageLocation, notes: claim.notes }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "loaded") throw new Error(payload.error ?? "Unable to save claim.");
      setClaims((current) => current.map((item) => item.id === claim.id ? payload.data : item));
    } catch (error) { editClaim(claim.id, { saving: false, error: error instanceof Error ? error.message : "Unable to save claim." }); }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6"><div><p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal Aid billing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Claims Tracker</h1><p className="mt-2 text-sm text-slate-600">Track each claim from generation through sending, payment and follow-up.</p></div><Link href="/billing" className="rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700">Create billing form</Link></header>
        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Summary label="Claimed this week" value={totals.claimedWeek} /><Summary label="Claimed this month" value={totals.claimedMonth} /><Summary label="Paid this week" value={totals.paidWeek} /><Summary label="Paid this month" value={totals.paidMonth} /><Summary label="Outstanding" value={totals.outstanding} /><Summary label="Overdue" value={totals.overdue} warning /></section>
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Unpaid Claims Requiring Follow-Up</h2>{followUp.length ? <div className="mt-3 grid gap-2 lg:grid-cols-2">{followUp.map((claim) => <div key={claim.id} className="rounded-md border border-amber-200 bg-white px-3 py-3 text-sm text-amber-950"><strong>{claim.claimId}</strong><span className="mx-2 text-amber-400">·</span>{claim.clientName}<span className="float-right font-semibold">{currency.format(claim.outstandingAmount)}</span>{claim.paidStatus === "Part Paid" ? <span className="mt-2 block text-xs font-semibold">Part paid — balance requires follow-up</span> : <span className="mt-2 block text-xs font-semibold">Not paid after 14 days</span>}</div>)}</div> : <p className="mt-2 text-sm text-amber-800">No claims currently require follow-up.</p>}</section>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-form"><div className="grid gap-3 md:grid-cols-4"><Filter label="Search claims" value={search} onChange={setSearch} placeholder="Client, matter, Legal Aid or claim ID" /><Filter label="Sent from" type="date" value={dateFrom} onChange={setDateFrom} /><Filter label="Sent to" type="date" value={dateTo} onChange={setDateTo} /><label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lifecycle<select className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{["All", "Draft", "Generated", "Sent", "Paid", "Overdue"].map((value) => <option key={value}>{value}</option>)}</select></label></div></section>
        {pageError ? <p className="mt-6 rounded-md bg-red-50 p-4 text-sm font-medium text-red-700">{pageError}</p> : null}
        <section className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-form"><table className="min-w-[1840px] w-full text-sm"><thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>{["Claim", "Client / Legal Aid", "Matter", "Form", "Claimed", "Generated", "Sent", "Lifecycle", "Payment", "Paid", "Outstanding", "Storage", "Notes", "Actions"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody>{filteredClaims.map((claim) => <ClaimRow key={claim.id} claim={claim} editClaim={editClaim} saveClaim={saveClaim} />)}{!loading && !filteredClaims.length ? <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500">No claims match these filters.</td></tr> : null}{loading ? <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500">Loading claims…</td></tr> : null}</tbody></table></section>
      </div>
    </main>
  );
}

function ClaimRow({ claim, editClaim, saveClaim }: { claim: EditableClaim; editClaim: (id: string, changes: Partial<EditableClaim>) => void; saveClaim: (claim: EditableClaim, markPaid?: boolean) => Promise<void> }) {
  const displayStatus = claimIsOverdue(claim) ? "Overdue" : claim.lifecycleStatus;
  return <tr className="border-t border-slate-200 align-top"><td className="px-3 py-3 font-mono text-xs font-semibold">{claim.claimId}{displayStatus === "Overdue" ? <span className="mt-2 block w-fit rounded bg-amber-100 px-2 py-1 font-sans text-[11px] text-amber-900">Not paid after 14 days</span> : null}</td><td className="px-3 py-3"><p className="font-semibold">{claim.clientName}</p><p className="mt-1 text-xs text-slate-500">{claim.legalAidNumber || "No Legal Aid number"}</p></td><td className="max-w-56 px-3 py-3 text-slate-700">{claim.matterName}</td><td className="px-3 py-3">{claim.formType}</td><td className="px-3 py-3 font-medium">{currency.format(claim.amountClaimed)}</td><td className="px-3 py-3">{claim.dateGenerated}</td><td className="px-3 py-3"><input aria-label={`Date sent for ${claim.claimId}`} type="date" className="h-9 rounded border border-slate-300 px-2" value={claim.dateSent} onChange={(event) => editClaim(claim.id, { dateSent: event.target.value, lifecycleStatus: event.target.value ? "Sent" : claim.lifecycleStatus })} /></td><td className="px-3 py-3"><select aria-label={`Lifecycle for ${claim.claimId}`} className="h-9 rounded border border-slate-300 bg-white px-2" value={displayStatus === "Overdue" ? "Sent" : claim.lifecycleStatus} onChange={(event) => editClaim(claim.id, { lifecycleStatus: event.target.value as LegalAidClaimLifecycle })}>{lifecycleOptions.map((value) => <option key={value}>{value}</option>)}</select></td><td className="px-3 py-3"><StatusBadge label={claim.paidStatus} tone={claim.paidStatus === "Paid" ? "green" : claim.paidStatus === "Part Paid" ? "blue" : "grey"} /></td><td className="px-3 py-3"><input aria-label={`Amount paid for ${claim.claimId}`} type="number" min="0" max={claim.amountClaimed} step="0.01" className="h-9 w-28 rounded border border-slate-300 px-2" value={claim.amountPaid} onChange={(event) => editClaim(claim.id, { amountPaid: Number(event.target.value) || 0 })} /><input aria-label={`Date paid for ${claim.claimId}`} type="date" className="mt-2 h-9 rounded border border-slate-300 px-2" value={claim.datePaid} onChange={(event) => editClaim(claim.id, { datePaid: event.target.value })} /></td><td className="px-3 py-3 font-semibold">{currency.format(claim.outstandingAmount)}</td><td className="px-3 py-3"><input aria-label={`Storage provider for ${claim.claimId}`} className="h-9 w-32 rounded border border-slate-300 px-2" value={claim.storageProvider} placeholder="Provider" onChange={(event) => editClaim(claim.id, { storageProvider: event.target.value })} /><input aria-label={`Storage location for ${claim.claimId}`} className="mt-2 h-9 w-48 rounded border border-slate-300 px-2" value={claim.storageLocation} placeholder="Location" onChange={(event) => editClaim(claim.id, { storageLocation: event.target.value })} /></td><td className="px-3 py-3"><textarea aria-label={`Notes for ${claim.claimId}`} className="min-h-20 w-48 rounded border border-slate-300 px-2 py-1" value={claim.notes} onChange={(event) => editClaim(claim.id, { notes: event.target.value })} /></td><td className="px-3 py-3"><button type="button" disabled={claim.saving} onClick={() => void saveClaim(claim)} className="rounded bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{claim.saving ? "Saving…" : "Save"}</button><button type="button" disabled={claim.saving || claim.paidStatus === "Paid"} onClick={() => void saveClaim(claim, true)} className="mt-2 block rounded border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-40">Mark paid</button>{claim.error ? <p className="mt-2 max-w-40 text-xs text-red-700">{claim.error}</p> : null}</td></tr>;
}

function Summary({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className={warning ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border border-slate-200 bg-white p-4"}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={warning ? "mt-2 text-xl font-semibold text-amber-900" : "mt-2 text-xl font-semibold text-slate-950"}>{currency.format(value)}</p></div>; }
function Filter({ label, value, onChange, type = "search", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}<input type={type} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
function StatusBadge({ label, tone }: { label: string; tone: "green" | "blue" | "grey" }) { const style = tone === "green" ? "bg-emerald-100 text-emerald-800" : tone === "blue" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{label}</span>; }
