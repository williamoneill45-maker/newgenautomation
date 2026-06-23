"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  billingInvoicesStorageKey,
  isInvoiceWithinRetention,
  type StoredBillingInvoice,
} from "../lib/billing-storage";

function readInvoices(): StoredBillingInvoice[] {
  try {
    const raw = window.localStorage.getItem(billingInvoicesStorageKey);
    return raw ? (JSON.parse(raw) as StoredBillingInvoice[]) : [];
  } catch {
    window.localStorage.removeItem(billingInvoicesStorageKey);
    return [];
  }
}

function mergeInvoices(
  localInvoices: StoredBillingInvoice[],
  supabaseInvoices: StoredBillingInvoice[],
): StoredBillingInvoice[] {
  const merged = new Map<string, StoredBillingInvoice>();
  for (const invoice of localInvoices.filter(isInvoiceWithinRetention)) merged.set(invoice.id, invoice);
  for (const invoice of supabaseInvoices.filter(isInvoiceWithinRetention)) {
    merged.set(invoice.id, { ...merged.get(invoice.id), ...invoice });
  }
  return [...merged.values()];
}

export function BillingEvidenceNotifications() {
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);

  useEffect(() => {
    const localInvoices = readInvoices().filter(isInvoiceWithinRetention);
    setInvoices(localInvoices);

    fetch("/api/billing-records")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; invoices?: StoredBillingInvoice[] } | null) => {
        if (payload?.status !== "loaded" || !Array.isArray(payload.invoices)) return;
        const merged = mergeInvoices(localInvoices, payload.invoices);
        setInvoices(merged);
        window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(merged));
      })
      .catch(() => undefined);
  }, []);

  const pendingInvoices = useMemo(() =>
    invoices.filter((invoice) => invoice.status === "pending_evidence"),
  [invoices]);

  if (!pendingInvoices.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-amber-950">Billing evidence needed</h3>
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          {pendingInvoices.length} pending
        </span>
      </div>
      <div className="mt-2 space-y-2 text-sm leading-5 text-amber-900">
        {pendingInvoices.slice(0, 3).map((invoice) => (
          <p key={invoice.id}>
            {invoice.clientName} - {invoice.invoiceNumber}: {(invoice.missingEvidence ?? []).join(", ") || "supporting evidence"}.
          </p>
        ))}
      </div>
      <Link href={`/billing/register?record=${encodeURIComponent(pendingInvoices[0]?.id ?? "")}`} className="mt-2 inline-flex text-sm font-semibold text-amber-950 hover:text-amber-800">
        Open pending invoice
      </Link>
    </div>
  );
}
