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

function mergeById<T extends { id: string }>(localItems: T[], remoteItems: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of localItems) merged.set(item.id, item);
  for (const item of remoteItems) merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [legalAidRecords, setLegalAidRecords] = useState<LegalAidRecord[]>([]);
  const [clientEmail, setClientEmail] = useState("");
  const [applicationType, setApplicationType] = useState<BillingClientProfile["applicationType"]>("");
  const [isStartingInduction, setIsStartingInduction] = useState(false);
  const [inductionNotice, setInductionNotice] = useState("");
  const [inductionError, setInductionError] = useState("");

  useEffect(() => {
    const localClients = readJsonArray<BillingClientProfile>(billingClientsStorageKey);
    const localInvoices = readJsonArray<StoredBillingInvoice>(billingInvoicesStorageKey).filter(isInvoiceWithinRetention);
    setClients(localClients);
    setInvoices(localInvoices);
    setMatters(readJsonArray<MatterFile>(recentMattersStorageKey));

    fetch("/api/billing-clients")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; clients?: BillingClientProfile[] } | null) => {
        if (payload?.status === "loaded" && Array.isArray(payload.clients)) {
          setClients(mergeById(localClients, payload.clients));
        }
      })
      .catch(() => undefined);

    fetch("/api/billing-records")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; invoices?: StoredBillingInvoice[] } | null) => {
        if (payload?.status === "loaded" && Array.isArray(payload.invoices)) {
          setInvoices(mergeById(localInvoices, payload.invoices).filter(isInvoiceWithinRetention));
        }
      })
      .catch(() => undefined);

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

  useEffect(() => {
    if (!client) return;
    setClientEmail(client.clientEmail ?? "");
    setApplicationType(client.applicationType ?? "");
  }, [client]);

  function updateStoredClient(updatedClient: BillingClientProfile) {
    setClients((currentClients) => {
      const nextClients = currentClients.map((item) =>
        item.id === updatedClient.id ? { ...item, ...updatedClient } : item,
      );
      window.localStorage.setItem(billingClientsStorageKey, JSON.stringify(nextClients));
      return nextClients;
    });
  }

  async function startInduction() {
    if (!client) return;

    setIsStartingInduction(true);
    setInductionNotice("");
    setInductionError("");

    try {
      const response = await fetch("/api/clients/start-induction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          clientEmail,
          applicationType,
        }),
      });
      const payload = await response.json() as {
        status?: string;
        error?: string;
        client?: BillingClientProfile;
        folders?: { clientFolderPath?: string; formsFolderPath?: string; billingFolderPath?: string };
        signing?: { status?: string; message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to start induction.");
      }

      if (payload.client) updateStoredClient(payload.client);
      setInductionNotice([
        `Induction folders ready: ${payload.folders?.formsFolderPath ?? payload.client?.oneDriveFormsFolderPath ?? "Forms and Induction"}.`,
        payload.signing?.message ?? "",
      ].filter(Boolean).join(" "));
    } catch (error) {
      setInductionError(error instanceof Error ? error.message : "Unable to start induction.");
    } finally {
      setIsStartingInduction(false);
    }
  }

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

        <Panel title="Client induction" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700" htmlFor="client-email">
              Client email
              <input
                id="client-email"
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="client@example.co.nz"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700" htmlFor="application-type">
              Application type
              <select
                id="application-type"
                value={applicationType}
                onChange={(event) => setApplicationType(event.target.value as BillingClientProfile["applicationType"])}
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">Choose type</option>
                <option value="parenting">Parenting only</option>
                <option value="protection">Protection only</option>
                <option value="both">Protection and parenting</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={isStartingInduction}
                onClick={startInduction}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isStartingInduction ? "Starting..." : "Start induction"}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <StatusLine label="Engagement" value={client.engagementStatus ?? "not_started"} />
            <StatusLine label="MSD request" value={client.msdRequestStatus ?? "not_started"} />
            <StatusLine label="Legal Aid" value={client.legalAidApplicationStatus ?? "not_started"} />
          </div>
          {client.oneDriveClientFolderPath ? (
            <p className="mt-3 text-sm text-slate-600">
              OneDrive folder: {client.oneDriveClientFolderPath}
            </p>
          ) : null}
          {inductionNotice ? <p className="mt-3 text-sm font-medium text-emerald-700">{inductionNotice}</p> : null}
          {inductionError ? <p className="mt-3 text-sm font-medium text-red-700">{inductionError}</p> : null}
        </Panel>

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
                    <td className="px-4 py-3 font-medium text-slate-950">
                      <Link href={`/invoices/${invoice.id}`} className="text-sky-700 hover:text-sky-900">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
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

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium capitalize text-slate-950">{value.replace(/_/g, " ")}</p>
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
