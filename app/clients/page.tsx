"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  billingClientsStorageKey,
  billingInvoicesStorageKey,
  isInvoiceWithinRetention,
  type BillingClientProfile,
  type StoredBillingInvoice,
} from "../../lib/billing-storage";

function readJsonArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function mergeClients(
  localClients: BillingClientProfile[],
  supabaseClients: BillingClientProfile[],
): BillingClientProfile[] {
  const merged = new Map<string, BillingClientProfile>();

  for (const client of localClients) {
    merged.set(client.id, client);
  }

  for (const client of supabaseClients) {
    const existing = merged.get(client.id);
    merged.set(client.id, {
      ...existing,
      ...client,
      legalAidNumber: client.legalAidNumber || existing?.legalAidNumber || "",
      createdAt: client.createdAt || existing?.createdAt || "",
      updatedAt: client.updatedAt || existing?.updatedAt || "",
    });
  }

  return [...merged.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
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

export default function ClientsPage() {
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const localClients = readJsonArray<BillingClientProfile>(billingClientsStorageKey);
    const localInvoices = readJsonArray<StoredBillingInvoice>(billingInvoicesStorageKey).filter(isInvoiceWithinRetention);
    setClients(localClients);
    setInvoices(localInvoices);

    fetch("/api/billing-clients")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<
          | { status: "loaded"; clients: BillingClientProfile[] }
          | { status: "not_configured"; missing: string[] }
        >;
      })
      .then((payload) => {
        if (payload?.status !== "loaded") return;
        const mergedClients = mergeClients(localClients, payload.clients);
        setClients(mergedClients);
        window.localStorage.setItem(billingClientsStorageKey, JSON.stringify(mergedClients));
      })
      .catch(() => undefined);

    fetch("/api/billing-records")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<
          | { status: "loaded"; invoices: StoredBillingInvoice[] }
          | { status: "not_configured"; missing: string[] }
        >;
      })
      .then((payload) => {
        if (payload?.status !== "loaded") return;
        const mergedInvoices = mergeInvoices(localInvoices, payload.invoices);
        setInvoices(mergedInvoices);
        window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(mergedInvoices));
      })
      .catch(() => undefined);
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return clients;

    return clients.filter((client) =>
      [client.clientName, client.legalAidNumber].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [clients, query]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to dashboard
          </Link>
          <Link href="/billing" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
            New billing invoice
          </Link>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Billing clients</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Client Details</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Store the billing details needed to prepare invoices: client name and legal aid number.
          </p>
        </header>

        <section className="mb-6 rounded-lg border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-base font-semibold text-sky-950">Later development</h2>
          <p className="mt-2 text-sm leading-6 text-sky-900">
            This client details area will later become the proceedings update page, showing where each matter is at,
            what has been filed, what is due next, and what documents or billing entries are outstanding.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold text-slate-950">Profiles</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or legal aid number"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:max-w-sm"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Legal aid number</th>
                  <th className="px-4 py-3">Invoices</th>
                  <th className="px-4 py-3">Total billed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredClients.map((client) => {
                  const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
                  const total = clientInvoices.reduce((sum, invoice) => sum + invoice.invoiceTotal, 0);

                  return (
                    <tr key={client.id}>
                      <td className="px-4 py-3 font-medium text-slate-950">
                        <Link href={`/clients/${client.id}`} className="text-sky-700 hover:text-sky-900">
                          {client.clientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{client.legalAidNumber || "Not supplied"}</td>
                      <td className="px-4 py-3 text-slate-700">{clientInvoices.length}</td>
                      <td className="px-4 py-3 text-slate-700">${total.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {!filteredClients.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No billing client profiles yet. Create one from the Billing Workbench.
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
