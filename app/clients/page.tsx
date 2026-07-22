"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  billingClientsStorageKey,
  billingInvoicesStorageKey,
  createBillingClientId,
  normalizeClientName,
  type BillingClientProfile,
  type StoredBillingInvoice,
} from "../../lib/billing-storage";
import { demoMatter, isDemoEnvironment } from "../../lib/demo-data";
import { recentMattersStorageKey } from "../../lib/legal-aid";
import { createEmptyMatter, normalizeProceedingsType, type MatterFile } from "../../lib/matter";

type MattersPayload = {
  status?: string;
  data?: MatterFile[];
  missing?: string[];
  error?: string;
};

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

function writeMatters(matters: MatterFile[]) {
  window.localStorage.setItem(recentMattersStorageKey, JSON.stringify(matters.slice(0, 100)));
}

function sharedMatterStorageMessage(responseStatus: number, payload: MattersPayload | null): string {
  if (responseStatus === 401) {
    return "Log in on this Vercel link to load and save shared matters. Anything saved before login is only stored in this browser.";
  }
  if (payload?.status === "not_configured") {
    return `Shared matter storage is not configured on this deployment (${payload.missing?.join(", ") || "missing Supabase settings"}). Matters saved here stay in this browser only.`;
  }
  if (payload?.error) {
    return `Shared matter storage failed: ${payload.error}`;
  }
  return "Shared matter storage could not be reached. Matters shown here may only be saved in this browser.";
}

async function saveMatterToSharedStorage(matter: MatterFile): Promise<boolean> {
  try {
    const response = await fetch("/api/matters", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matter }),
    });
    const payload = await response.json().catch(() => null) as MattersPayload | null;
    return response.ok && payload?.status === "saved";
  } catch {
    return false;
  }
}

function matterCompleteness(matter: MatterFile): number {
  return [
    matter.clientName,
    matter.legalAidNumber,
    matter.intake.famNumber,
    matter.intake.courtLocation,
    matter.intake.proceedingsType,
    matter.intake.applicant.fullName,
    matter.intake.applicant.dateOfBirth,
    matter.intake.applicant.homeAddress,
    matter.intake.applicant.mobilePhone,
    matter.intake.respondent.fullName,
    matter.intake.respondent.dateOfBirth,
    matter.intake.respondent.homeAddress,
    matter.intake.relationship.deFactoRelationshipStart,
    matter.intake.relationship.relationshipEndDate,
    matter.intake.proceedings.previousApplications,
    matter.intake.proceedings.existingOrdersBetweenParties,
    matter.intake.proceedings.existingOrdersRelatingToChildren,
    matter.intake.domesticViolenceNotes.history,
    matter.intake.domesticViolenceNotes.recentEvents,
    ...matter.intake.selectedApplications,
    ...matter.intake.children.flatMap((child) => [
      child.fullName,
      child.dateOfBirth,
      child.livingWithName,
      child.applicantRelationshipToChild,
      child.respondentRelationshipToChild,
    ]),
  ].filter((value) => String(value ?? "").trim()).length;
}

function mergeMatters(localMatters: MatterFile[], remoteMatters: MatterFile[]): MatterFile[] {
  const byId = new Map<string, MatterFile>();
  for (const matter of [...remoteMatters, ...localMatters]) {
    const existing = byId.get(matter.id);
    if (!existing) {
      byId.set(matter.id, matter);
      continue;
    }

    const existingScore = matterCompleteness(existing);
    const matterScore = matterCompleteness(matter);
    byId.set(
      matter.id,
      matterScore >= existingScore
        ? { ...existing, ...matter, intake: { ...existing.intake, ...matter.intake } }
        : { ...matter, ...existing, intake: { ...matter.intake, ...existing.intake } },
    );
  }

  return [...byId.values()].sort((left, right) =>
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function matterFromCsv(row: Record<string, string>): MatterFile | null {
  const clientName = normalizeClientName(row.client_name || row.client || row.name || "");
  const famNumber = row.fam_number || row.family_number || row.fam || "";
  if (!clientName || !famNumber) return null;
  const matter = createEmptyMatter();
  const legalAidRequired = !["false", "no", "n", "0"].includes(String(row.legal_aid_required ?? "true").toLowerCase());
  matter.id = `matter-${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${famNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  matter.clientName = clientName.toLocaleUpperCase("en-NZ");
  matter.legalAidNumber = row.legal_aid_number || row.legal_aid || "";
  matter.legalAidRequired = legalAidRequired;
  matter.intake.applicant.fullName = matter.clientName;
  matter.intake.respondent.fullName = (row.respondent_name || row.respondent || "").toLocaleUpperCase("en-NZ");
  matter.intake.famNumber = famNumber;
  matter.intake.courtLocation = row.court as MatterFile["intake"]["courtLocation"] || "";
  matter.intake.proceedingsType = normalizeProceedingsType(row.proceedings_type || row.proceedings || "");
  matter.status = "draft";
  matter.updatedAt = new Date().toISOString();
  return matter;
}

export default function MattersPage() {
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [invoices, setInvoices] = useState<StoredBillingInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const localMatters = read<MatterFile>(recentMattersStorageKey);
    setMatters(localMatters.length ? localMatters : isDemoEnvironment ? [demoMatter] : []);
    setInvoices(read<StoredBillingInvoice>(billingInvoicesStorageKey));
    void fetch("/api/matters", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as MattersPayload | null;
        if (!response.ok || payload?.status === "not_configured") {
          setNotice(sharedMatterStorageMessage(response.status, payload));
          return null;
        }
        return payload;
      })
      .then((payload) => {
        if (payload?.status === "loaded" && payload.data?.length) {
          setMatters((current) => {
            const merged = mergeMatters(current.length ? current : localMatters, payload.data ?? []);
            writeMatters(merged);
            return merged;
          });
        }
      })
      .catch(() => {
        setNotice(sharedMatterStorageMessage(0, null));
      });
  }, []);

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const headers = csvCells(lines[0] ?? "").map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
    const imported = lines.slice(1).map((line) => {
      const values = csvCells(line);
      return matterFromCsv(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
    }).filter((matter): matter is MatterFile => Boolean(matter));

    const nextMatters = [
      ...imported,
      ...matters.filter((matter) => !imported.some((item) => item.id === matter.id)),
    ];
    setMatters(nextMatters);
    writeMatters(nextMatters);

    const existingClients = read<BillingClientProfile>(billingClientsStorageKey);
    const importedClients = imported.map((matter) => ({
      id: createBillingClientId(`${matter.clientName}-${matter.id}`),
      clientName: matter.clientName,
      legalAidNumber: matter.legalAidNumber,
      famNumber: matter.intake.famNumber,
      applicationType: matter.intake.proceedingsType === "both" ? "both" : matter.intake.proceedingsType === "care_of_children" ? "parenting" : matter.intake.proceedingsType === "protection_order" ? "protection" : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies BillingClientProfile));
    window.localStorage.setItem(
      billingClientsStorageKey,
      JSON.stringify([...importedClients, ...existingClients.filter((client) => !importedClients.some((item) => item.clientName === client.clientName))]),
    );

    const sharedResults = await Promise.all(imported.map((matter) => saveMatterToSharedStorage(matter)));
    const sharedFailures = sharedResults.filter((saved) => !saved).length;

    setNotice(sharedFailures
      ? `${imported.length} matter${imported.length === 1 ? "" : "s"} imported into this browser. ${sharedFailures} did not save to shared matter storage, so they will not appear on a different Vercel link until shared storage is available.`
      : `${imported.length} matter${imported.length === 1 ? "" : "s"} imported and saved to shared matter storage.`);
    event.target.value = "";
  }

  const rows = useMemo(() => matters.map((matter) => {
    const clientInvoices = invoices.filter((invoice) =>
      invoice.clientId === matter.id ||
      invoice.clientName.toLowerCase() === (matter.clientName || matter.intake.applicant.fullName).toLowerCase(),
    );
    return { matter, invoices: clientInvoices, total: clientInvoices.reduce((sum, invoice) => sum + invoice.invoiceTotal, 0) };
  }).filter(({ matter }) => {
    const search = query.trim().toLowerCase();
    return !search || [
      matter.clientName,
      matter.legalAidNumber,
      matter.intake.famNumber,
      matter.intake.courtLocation,
      matter.intake.respondent.fullName,
    ].some((value) => value.toLowerCase().includes(search));
  }), [matters, invoices, query]);
  const noticeIsWarning = /browser|failed|Log in|not configured|could not/i.test(notice);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Matter workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Matters</h1>
            <p className="mt-2 text-sm text-slate-600">Find, import, and reopen matter intakes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void importCsv(event)} />
            </label>
            <Link href="/new-client" className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700">Create New Matter</Link>
          </div>
        </header>
        {notice ? <p className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${noticeIsWarning ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{notice}</p> : null}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold text-slate-950">All matters</h2>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, Legal Aid, FAM number, court or respondent" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:max-w-md" />
          </div>
          <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Matter</th><th className="px-4 py-3">Legal Aid</th><th className="px-4 py-3">Court</th><th className="px-4 py-3">Proceedings</th><th className="px-4 py-3">Billing</th><th className="px-4 py-3">Documents</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(({ matter, invoices: matterInvoices, total }) => <tr key={matter.id}>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-950">{matter.clientName || matter.intake.applicant.fullName}</p><p className="mt-1 text-xs text-slate-500">{matter.intake.famNumber || "FAM number not supplied"}</p></td>
                  <td className="px-4 py-3 text-slate-700">{matter.legalAidRequired ? matter.legalAidNumber || "Required - number not supplied" : "Not required"}</td>
                  <td className="px-4 py-3 text-slate-700">{matter.intake.courtLocation || "Not selected"}</td>
                  <td className="px-4 py-3 text-slate-700">{matter.intake.proceedingsType === "both" ? "Protection and Parenting" : matter.intake.proceedingsType.replace(/_/g, " ") || "Not selected"}</td>
                  <td className="px-4 py-3 text-slate-700">{matterInvoices.length} record{matterInvoices.length === 1 ? "" : "s"} · ${total.toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge label={matter.status === "documents_generated" ? "Generated" : "Ready for review"} tone={matter.status === "documents_generated" ? "green" : "blue"} /></td>
                  <td className="px-4 py-3"><Link href={`/new-client?matterId=${encodeURIComponent(matter.id)}`} className="font-semibold text-sky-700 hover:text-sky-900">Open matter</Link></td>
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
