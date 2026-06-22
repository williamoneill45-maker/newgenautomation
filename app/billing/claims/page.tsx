"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LegalAidClaim, LegalAidClaimStatus } from "../../../lib/legal-aid-claims";

type EditableClaim = LegalAidClaim & { saving?: boolean; error?: string };

const currency = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" });
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

function isOverdue(claim: LegalAidClaim): boolean {
  const sent = new Date(`${claim.dateSent}T00:00:00+12:00`);
  return claim.paidStatus !== "Paid" && Date.now() - sent.getTime() > 14 * 24 * 60 * 60 * 1000;
}

function isThisWeek(date: string): boolean {
  if (!date) return false;
  const value = new Date(`${date}T00:00:00+12:00`);
  const now = new Date();
  const monday = new Date(now);
  const weekday = (now.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - weekday);
  return value >= monday;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<EditableClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [matterSearch, setMatterSearch] = useState("");
  const [claimSearch, setClaimSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<"All" | LegalAidClaimStatus>("All");

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/legal-aid-claims", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load claims.");
      if (payload.status === "not_configured") throw new Error(`Claims database is not configured: ${payload.missing.join(", ")}.`);
      setClaims(payload.data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load claims.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const filteredClaims = useMemo(() => claims.filter((claim) => {
    const clientMatches = claim.clientName.toLowerCase().includes(clientSearch.trim().toLowerCase());
    const matterMatches = claim.matterName.toLowerCase().includes(matterSearch.trim().toLowerCase());
    const claimMatches = claim.claimId.toLowerCase().includes(claimSearch.trim().toLowerCase());
    const dateMatches = (!dateFrom || claim.dateSent >= dateFrom) && (!dateTo || claim.dateSent <= dateTo);
    return clientMatches && matterMatches && claimMatches && dateMatches && (status === "All" || claim.paidStatus === status);
  }), [claims, clientSearch, matterSearch, claimSearch, dateFrom, dateTo, status]);

  const followUp = useMemo(() => claims.filter((claim) => isOverdue(claim) || (claim.paidStatus === "Part Paid" && claim.outstandingAmount > 0)), [claims]);
  const totals = useMemo(() => ({
    claimedWeek: claims.filter((claim) => isThisWeek(claim.dateSent)).reduce((sum, claim) => sum + claim.amountClaimed, 0),
    claimedMonth: claims.reduce((sum, claim) => sum + claim.amountClaimed, 0),
    paidWeek: claims.filter((claim) => isThisWeek(claim.datePaid)).reduce((sum, claim) => sum + claim.amountPaid, 0),
    paidMonth: claims.reduce((sum, claim) => sum + claim.amountPaid, 0),
    outstanding: claims.reduce((sum, claim) => sum + claim.outstandingAmount, 0),
    overdue: claims.filter(isOverdue).reduce((sum, claim) => sum + claim.outstandingAmount, 0),
  }), [claims]);

  function editClaim(id: string, changes: Partial<EditableClaim>) {
    setClaims((current) => current.map((claim) => claim.id === id ? { ...claim, ...changes, error: "" } : claim));
  }

  async function saveClaim(claim: EditableClaim, markPaid?: boolean) {
    editClaim(claim.id, { saving: true });
    try {
      const response = await fetch("/api/legal-aid-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: claim.id,
          markPaid,
          amountPaid: markPaid ? claim.amountClaimed : claim.amountPaid,
          datePaid: markPaid ? claim.datePaid || today : claim.datePaid,
          notes: claim.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== "loaded") throw new Error(payload.error ?? "Unable to save claim.");
      setClaims((current) => current.map((item) => item.id === claim.id ? payload.data : item));
    } catch (error) {
      editClaim(claim.id, { saving: false, error: error instanceof Error ? error.message : "Unable to save claim." });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal Aid billing</p><h1 className="mt-2 text-3xl font-semibold text-slate-950">Claims Tracker</h1><p className="mt-2 text-sm text-slate-600">Claims sent in the current month only.</p></div>
          <Link href="/billing" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Generate Form32B or Form33A</Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Summary label="Claimed this week" value={totals.claimedWeek} />
          <Summary label="Claimed this month" value={totals.claimedMonth} />
          <Summary label="Paid this week" value={totals.paidWeek} />
          <Summary label="Paid this month" value={totals.paidMonth} />
          <Summary label="Outstanding" value={totals.outstanding} />
          <Summary label="Overdue" value={totals.overdue} warning />
        </section>

        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Unpaid Claims Requiring Follow-Up</h2>
          {followUp.length ? <div className="mt-3 flex flex-wrap gap-2">{followUp.map((claim) => <span key={claim.id} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950"><strong>{claim.claimId}</strong> · {claim.clientName} · {currency.format(claim.outstandingAmount)} outstanding</span>)}</div> : <p className="mt-2 text-sm text-amber-800">No claims currently require follow-up.</p>}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Filter label="Client" value={clientSearch} onChange={setClientSearch} placeholder="Search client" />
            <Filter label="Matter" value={matterSearch} onChange={setMatterSearch} placeholder="Search matter" />
            <Filter label="Claim ID" value={claimSearch} onChange={setClaimSearch} placeholder="Search claim ID" />
            <Filter label="Sent from" type="date" value={dateFrom} onChange={setDateFrom} />
            <Filter label="Sent to" type="date" value={dateTo} onChange={setDateTo} />
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paid status<select className="mt-1 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{["All", "Unpaid", "Paid", "Part Paid"].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
        </section>

        {pageError ? <p className="mt-6 rounded-md bg-red-50 p-4 text-sm font-medium text-red-700">{pageError}</p> : null}
        <section className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Claim ID", "Client", "Matter", "Form", "Amount claimed", "Date sent", "Paid?", "Date paid", "Amount paid", "Outstanding", "Notes", "Actions"].map((heading) => <th key={heading} className="px-3 py-3 text-left font-semibold">{heading}</th>)}</tr></thead>
            <tbody>
              {filteredClaims.map((claim) => <tr key={claim.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-900">{claim.claimId}{isOverdue(claim) ? <span className="mt-1 block w-fit rounded bg-amber-100 px-2 py-1 font-sans text-[11px] text-amber-900">Not paid after 14 days</span> : null}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{claim.clientName}</td><td className="px-3 py-3 text-slate-700">{claim.matterName}</td><td className="px-3 py-3">{claim.formType}</td><td className="px-3 py-3 font-medium">{currency.format(claim.amountClaimed)}</td><td className="px-3 py-3">{claim.dateSent}</td>
                <td className="px-3 py-3"><label className="flex items-center gap-2"><input type="checkbox" checked={claim.paidStatus === "Paid"} onChange={(event) => void saveClaim({ ...claim, amountPaid: event.target.checked ? claim.amountClaimed : 0, datePaid: event.target.checked ? today : "" }, event.target.checked)} /><span className={claim.paidStatus === "Paid" ? "font-semibold text-emerald-700" : claim.paidStatus === "Part Paid" ? "font-semibold text-sky-700" : "text-slate-600"}>{claim.paidStatus}</span></label></td>
                <td className="px-3 py-3"><input aria-label={`Date paid for ${claim.claimId}`} type="date" className="h-9 rounded border border-slate-300 px-2" value={claim.datePaid} onChange={(event) => editClaim(claim.id, { datePaid: event.target.value })} /></td>
                <td className="px-3 py-3"><input aria-label={`Amount paid for ${claim.claimId}`} type="number" min="0" max={claim.amountClaimed} step="0.01" className="h-9 w-28 rounded border border-slate-300 px-2" value={claim.amountPaid} onChange={(event) => editClaim(claim.id, { amountPaid: Number(event.target.value) || 0 })} /></td>
                <td className="px-3 py-3 font-semibold">{currency.format(claim.outstandingAmount)}</td><td className="px-3 py-3"><textarea aria-label={`Notes for ${claim.claimId}`} className="min-h-16 w-48 rounded border border-slate-300 px-2 py-1" value={claim.notes} onChange={(event) => editClaim(claim.id, { notes: event.target.value })} /></td>
                <td className="px-3 py-3"><button type="button" disabled={claim.saving} onClick={() => void saveClaim(claim)} className="rounded bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-400">{claim.saving ? "Saving..." : "Save"}</button>{claim.error ? <p className="mt-2 max-w-40 text-xs text-red-700">{claim.error}</p> : null}</td>
              </tr>)}
              {!loading && !filteredClaims.length ? <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">No current-month claims match these filters.</td></tr> : null}
              {loading ? <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-500">Loading claims…</td></tr> : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className={warning ? "rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border border-slate-200 bg-white p-4"}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={warning ? "mt-2 text-xl font-semibold text-amber-900" : "mt-2 text-xl font-semibold text-slate-950"}>{currency.format(value)}</p></div>; }
function Filter({ label, value, onChange, type = "search", placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}<input type={type} className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
