"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { calculateBillingTotals } from "../../../lib/billing-document";
import {
  billingInvoicesStorageKey,
  type StoredBillingInvoice,
} from "../../../lib/billing-storage";
import type { LegalAidClaim, LegalAidClaimLifecycle } from "../../../lib/legal-aid-claims";

const resetMarkerKey = "newgenautomation:billingRegisterReset:v2026-06-23";
const currency = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" });

type RegisterRecord = {
  id: string;
  clientName: string;
  legalAidNumber: string;
  famNumber: string;
  reference: string;
  formType: string;
  date: string;
  amount: number;
  status: string;
  invoice?: StoredBillingInvoice;
  claim?: LegalAidClaim;
};

function readInvoices(): StoredBillingInvoice[] {
  try {
    return JSON.parse(window.localStorage.getItem(billingInvoicesStorageKey) ?? "[]") as StoredBillingInvoice[];
  } catch {
    window.localStorage.removeItem(billingInvoicesStorageKey);
    return [];
  }
}

function saveInvoices(invoices: StoredBillingInvoice[]) {
  window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(invoices));
}

function mergeRecords(invoices: StoredBillingInvoice[], claims: LegalAidClaim[]): RegisterRecord[] {
  const rows = new Map<string, RegisterRecord>();

  for (const invoice of invoices) {
    rows.set(invoice.invoiceNumber || invoice.id, {
      id: invoice.id,
      clientName: invoice.clientName,
      legalAidNumber: invoice.legalAidNumber,
      famNumber: invoice.famNumber,
      reference: invoice.invoiceNumber,
      formType: `Form ${invoice.formType}`,
      date: invoice.generatedAt?.slice(0, 10) || "",
      amount: invoice.invoiceTotal,
      status: invoice.status.replace(/_/g, " "),
      invoice,
    });
  }

  for (const claim of claims) {
    const key = claim.claimId;
    const existing = rows.get(key);
    rows.set(key, {
      id: existing?.id ?? claim.id,
      clientName: existing?.clientName || claim.clientName,
      legalAidNumber: existing?.legalAidNumber || claim.legalAidNumber,
      famNumber: existing?.famNumber || "",
      reference: existing?.reference || claim.claimId,
      formType: existing?.formType || `Form ${claim.formType}`,
      date: existing?.date || claim.dateGenerated || claim.dateSent,
      amount: existing?.amount || claim.amountClaimed,
      status: claim.lifecycleStatus === "Overdue" ? "Overdue" : claim.paidStatus === "Part Paid" ? "Part paid" : claim.lifecycleStatus,
      invoice: existing?.invoice,
      claim,
    });
  }

  return [...rows.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function evidenceImages(invoice?: StoredBillingInvoice) {
  return (invoice?.evidenceFiles ?? [])
    .filter((file) => file.dataUrl && (file.contentType === "image/png" || file.contentType === "image/jpeg"))
    .map((file) => ({
      fileName: file.fileName,
      contentType: file.contentType,
      dataUrl: file.dataUrl,
      label: file.label,
    }));
}

export default function BillingRegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">Loading billing register…</main>}>
      <BillingRegisterContent />
    </Suspense>
  );
}

function BillingRegisterContent() {
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [claims, setClaims] = useState<LegalAidClaim[]>([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("record") ?? "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [dateSent, setDateSent] = useState("");
  const [datePaid, setDatePaid] = useState("");
  const [notes, setNotes] = useState("");
  const [oneDriveConfigured, setOneDriveConfigured] = useState(false);

  useEffect(() => {
    async function load() {
      const alreadyReset = window.localStorage.getItem(resetMarkerKey);
      if (!alreadyReset) {
        window.localStorage.removeItem(billingInvoicesStorageKey);
        window.localStorage.setItem(resetMarkerKey, new Date().toISOString());
        setInvoices([]);
        setClaims([]);
        await Promise.allSettled([
          fetch("/api/billing-records", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearAll: true }) }),
          fetch("/api/legal-aid-claims", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearAll: true }) }),
        ]);
        setNotice("Old invoice and claims register data has been cleared. New generated billing records will appear here.");
        return;
      }

      const localInvoices = readInvoices();
      setInvoices(localInvoices);
      await Promise.allSettled([
        fetch("/api/billing-records").then(async (response) => {
          if (!response.ok) return;
          const payload = await response.json() as { status?: string; invoices?: StoredBillingInvoice[] };
          if (payload.status === "loaded" && Array.isArray(payload.invoices)) {
            const merged = new Map(localInvoices.map((invoice) => [invoice.id, invoice]));
            for (const invoice of payload.invoices) merged.set(invoice.id, { ...merged.get(invoice.id), ...invoice });
            const next = [...merged.values()];
            setInvoices(next);
            saveInvoices(next);
          }
        }),
        fetch("/api/legal-aid-claims").then(async (response) => {
          if (!response.ok) return;
          const payload = await response.json() as { status?: string; data?: LegalAidClaim[] };
          if (payload.status === "loaded" && Array.isArray(payload.data)) setClaims(payload.data);
        }),
        fetch("/api/onedrive-status").then(async (response) => {
          if (!response.ok) return;
          const payload = await response.json() as { configured?: boolean };
          setOneDriveConfigured(Boolean(payload.configured));
        }),
      ]);
    }
    void load();
  }, []);

  const records = useMemo(() => mergeRecords(invoices, claims), [invoices, claims]);
  const selected = useMemo(() =>
    records.find((record) => record.id === selectedId || record.reference === selectedId) ?? records[0] ?? null,
  [records, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setAmountPaid(String(selected.claim?.amountPaid ?? ""));
    setDateSent(selected.claim?.dateSent ?? "");
    setDatePaid(selected.claim?.datePaid ?? "");
    setNotes(selected.claim?.notes ?? "");
  }, [selected?.id, selected?.reference]);

  async function regenerate(uploadToOneDrive = false) {
    if (!selected?.invoice?.billingRecord) {
      setError("This record does not have a stored billing snapshot, so it cannot be regenerated exactly.");
      return;
    }
    setBusy(uploadToOneDrive ? "onedrive" : "regenerate");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/generate-billing-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: selected.invoice.billingRecord,
          reviewed: true,
          uploadToOneDrive,
          evidenceImages: evidenceImages(selected.invoice),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to regenerate billing document.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${selected.reference}.docx`;

      if (!uploadToOneDrive) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setNotice("Regenerated the billing DOCX from the stored snapshot.");
        return;
      }

      const oneDrivePath = decodeURIComponent(response.headers.get("X-OneDrive-Path") ?? "");
      const oneDriveUrl = decodeURIComponent(response.headers.get("X-OneDrive-Url") ?? "");
      const nextInvoice: StoredBillingInvoice = {
        ...selected.invoice,
        status: "onedrive_uploaded",
        oneDrivePath,
        oneDriveUrl,
        generatedFileName: fileName,
      };
      const nextInvoices = [nextInvoice, ...invoices.filter((invoice) => invoice.id !== nextInvoice.id)];
      setInvoices(nextInvoices);
      saveInvoices(nextInvoices);
      await fetch("/api/billing-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextInvoice) });
      setNotice(`Saved regenerated billing DOCX to OneDrive${oneDrivePath ? ` at ${oneDrivePath}` : ""}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to regenerate billing document.");
    } finally {
      setBusy("");
    }
  }

  async function savePayment(markPaid = false) {
    if (!selected?.claim) {
      setError("This record has no payment tracking row. Regenerate it from Billing with payment tracking enabled if payment status is required.");
      return;
    }
    setBusy(markPaid ? "paid" : "payment");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/legal-aid-claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.claim.id,
          markPaid,
          lifecycleStatus: (markPaid ? "Paid" : selected.claim.lifecycleStatus) as LegalAidClaimLifecycle,
          amountPaid: Number(amountPaid) || 0,
          dateSent,
          datePaid,
          notes,
        }),
      });
      const payload = await response.json() as { status?: string; data?: LegalAidClaim; error?: string };
      if (!response.ok || payload.status !== "loaded" || !payload.data) throw new Error(payload.error ?? "Unable to update payment status.");
      setClaims((current) => [payload.data!, ...current.filter((claim) => claim.id !== payload.data!.id)]);
      setNotice(markPaid ? "Marked as paid." : "Payment details updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update payment status.");
    } finally {
      setBusy("");
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    const confirmed = window.confirm(`Delete ${selected.reference} from the app register? This will not delete any OneDrive files.`);
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    setNotice("");
    try {
      if (selected.invoice) {
        const nextInvoices = invoices.filter((invoice) => invoice.id !== selected.invoice?.id);
        setInvoices(nextInvoices);
        saveInvoices(nextInvoices);
        await fetch("/api/billing-records", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: selected.invoice.id }) });
      }
      if (selected.claim) {
        setClaims((current) => current.filter((claim) => claim.id !== selected.claim?.id));
        await fetch("/api/legal-aid-claims", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.claim.id }) });
      }
      setSelectedId("");
      setNotice("Record deleted from the app register. OneDrive files were not touched.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete the record.");
    } finally {
      setBusy("");
    }
  }

  const outstanding = selected?.claim ? Math.max(0, selected.claim.amountClaimed - (Number(amountPaid) || 0)) : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to dashboard</Link>
          <Link href="/billing" className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Create billing form</Link>
        </div>

        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Billing Register</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">One simple register for generated invoices and Legal Aid claim payment tracking.</p>
        </header>

        {notice ? <p className="mt-5 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{notice}</p> : null}
        {error ? <p className="mt-5 rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p> : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-form">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Legal Aid</th>
                    <th className="px-4 py-3">FAM</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Form</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {records.map((record) => (
                    <tr key={`${record.id}-${record.reference}`} className={selected?.reference === record.reference ? "bg-sky-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-medium text-slate-950">{record.clientName || "Unnamed"}</td>
                      <td className="px-4 py-3">{record.legalAidNumber || "—"}</td>
                      <td className="px-4 py-3">{record.famNumber || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{record.reference}</td>
                      <td className="px-4 py-3">{record.formType}</td>
                      <td className="px-4 py-3">{record.date || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{currency.format(record.amount)}</td>
                      <td className="px-4 py-3"><Status label={record.status} /></td>
                      <td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(record.reference)} className="font-semibold text-sky-700 hover:text-sky-900">Open</button></td>
                    </tr>
                  ))}
                  {!records.length ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No billing records yet. Generate a billing form to add the first row.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            {!selected ? (
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Record detail</h2>
                <p className="mt-2 text-sm text-slate-600">Select a billing record to inspect, regenerate, mark paid, or delete it.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Record detail</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.reference}</h2>
                    <p className="mt-1 text-sm text-slate-600">{selected.clientName} · {selected.formType}</p>
                  </div>
                  <Status label={selected.status} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Legal Aid" value={selected.legalAidNumber || "Not supplied"} />
                  <Detail label="FAM" value={selected.famNumber || "Not supplied"} />
                  <Detail label="Generated" value={selected.invoice?.generatedAt?.slice(0, 10) || selected.date || "—"} />
                  <Detail label="Amount" value={currency.format(selected.amount)} />
                  <Detail label="OneDrive" value={selected.invoice?.oneDrivePath || "Not saved"} wide />
                  <Detail label="Evidence" value={(selected.invoice?.evidenceFiles ?? []).length ? `${selected.invoice?.evidenceFiles?.length} screenshot(s) appended` : "None"} wide />
                </dl>

                <div className="mt-5 space-y-2">
                  <button type="button" disabled={busy === "regenerate"} onClick={() => void regenerate(false)} className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === "regenerate" ? "Regenerating…" : "Regenerate DOCX"}</button>
                  {oneDriveConfigured ? <button type="button" disabled={busy === "onedrive"} onClick={() => void regenerate(true)} className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy === "onedrive" ? "Saving…" : "Save regenerated DOCX to OneDrive"}</button> : null}
                </div>

                <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">Payment</h3>
                  {selected.claim ? (
                    <div className="mt-3 grid gap-3">
                      <Input label="Date sent" type="date" value={dateSent} onChange={setDateSent} />
                      <NumberInput label="Amount paid" value={amountPaid} onChange={setAmountPaid} />
                      <Input label="Date paid" type="date" value={datePaid} onChange={setDatePaid} />
                      <p className="text-xs font-semibold text-slate-600">Outstanding: {currency.format(outstanding)}</p>
                      <label className="text-sm font-medium text-slate-700">Notes<textarea className="mt-1 min-h-24 w-full rounded border border-slate-300 px-2 py-1 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" disabled={busy === "payment"} onClick={() => void savePayment(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Save payment</button>
                        <button type="button" disabled={busy === "paid"} onClick={() => void savePayment(true)} className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Mark paid</button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">No payment tracking row exists for this record.</p>
                  )}
                </div>

                {selected.invoice?.billingRecord?.draft.standardWording ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-slate-950">Billing wording</h3>
                    <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{selected.invoice.billingRecord.draft.standardWording}</div>
                  </div>
                ) : null}

                <button type="button" disabled={busy === "delete"} onClick={() => void deleteSelected()} className="mt-6 w-full rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">{busy === "delete" ? "Deleting…" : "Delete from register"}</button>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Status({ label }: { label: string }) {
  const tone = label.toLowerCase().includes("paid") ? "bg-emerald-100 text-emerald-800" : label.toLowerCase().includes("overdue") ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>{label}</span>;
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "col-span-2" : ""}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value}</dd></div>;
}

function Input({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium text-slate-700">{label}<input type={type} className="mt-1 h-10 w-full rounded border border-slate-300 px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium text-slate-700">{label}<input type="number" min="0" step="0.01" className="mt-1 h-10 w-full rounded border border-slate-300 px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
