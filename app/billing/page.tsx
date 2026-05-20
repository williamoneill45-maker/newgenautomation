"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  travelReferences,
  type BillingCategory,
  type BillingDraft,
  type BillingFormType,
  type BillingRecord,
  type BillingStatus,
} from "../../lib/billing-automation";
import { calculateBillingTotals } from "../../lib/billing-document";
import {
  billingClientsStorageKey,
  billingInvoicesStorageKey,
  createBillingClientId,
  formatInvoiceNumber,
  normalizeClientName,
  type BillingClientProfile,
  type StoredBillingInvoice,
} from "../../lib/billing-storage";
import {
  form32BManagementRules,
  form32BSettingsStorageKey,
  type Form32BRuleSettings,
} from "../../lib/form32b-rules";
import {
  form33AManagementRules,
  form33ASettingsStorageKey,
  type Form33ARuleSettings,
} from "../../lib/form33a-rules";

const examplePrompt =
  "Pre-hearing conference and memorandum of consent from 11:00am-11:30am at Waitakere Court, parking $12.";

const categoryPrimaryRuleMap: Record<string, string> = {
  judicial_conference: "judicial-conference",
  pre_hearing_conference: "judicial-conference",
  formal_proof: "formal-proof",
  complying_judges_directions: "judge-directions",
  pre_hearing_matters: "pre-hearing-matters",
  defended_hearing: "defended-hearing",
  defended_protection_order: "defended-protection-order",
  instructing_agent: "instructing-agent",
  additional_factors: "additional-factors",
};

const categoryLabels: Record<BillingCategory, string> = {
  pre_hearing_conference: "Pre-hearing conference",
  judicial_conference: "Judicial conference",
  formal_proof: "Formal proof",
  instructing_agent: "Instructing agent",
  pre_hearing_matters: "Pre-hearing matters",
  defended_protection_order: "Defended protection order",
  additional_factors: "Additional factors",
  interlocutories: "Interlocutories",
  directions_conference: "Directions conference",
  settlement_conference: "Settlement conference",
  lawyer_for_child_report: "Lawyer for Child report",
  defended_hearing: "Defended hearing",
  consent_memorandum: "Memorandum of consent",
  complying_judges_directions: "Complying with Judge's directions",
  general_billing_entry: "General billing entry",
};

const reviewableCategories = Object.entries(categoryLabels)
  .filter(([category]) => category !== "general_billing_entry")
  .map(([category, label]) => ({ category: category as BillingCategory, label }));

const form32BCategoryPrimaryRuleMap: Record<string, string> = {
  pre_hearing_matters: "pre-hearing-matters",
  complying_judges_directions: "complying-judges-directions",
  instructing_agent: "instructing-agent",
  formal_proof: "formal-proof",
  settlement_conference: "settlement-conference",
  consent_memorandum: "memorandum-of-consent",
  lawyer_for_child_report: "report",
  additional_factors: "additional-factors",
  defended_hearing: "defended-hearing",
  directions_conference: "directions-conference",
  pre_hearing_conference: "pre-hearing-conference",
};

type EditableBillingDraftField =
  | "clientName"
  | "legalAidNumber"
  | "invoiceNumber"
  | "court"
  | "date"
  | "startTime"
  | "endTime"
  | "attendanceHours"
  | "parking"
  | "officeDisbursements"
  | "standardWording";

function readJsonArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createClientProfile(clientName: string, legalAidNumber: string, famNumber: string): BillingClientProfile {
  const now = new Date().toISOString();
  const normalizedName = normalizeClientName(clientName);

  return {
    id: createBillingClientId(`${normalizedName}-${legalAidNumber || famNumber || now}`),
    clientName: normalizedName,
    legalAidNumber: legalAidNumber.trim(),
    famNumber: famNumber.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export default function BillingPage() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const [formType, setFormType] = useState<BillingFormType>("33A");
  const [clients, setClients] = useState<BillingClientProfile[]>([]);
  const [clientName, setClientName] = useState("");
  const [legalAidNumber, setLegalAidNumber] = useState("");
  const [famNumber, setFamNumber] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientNotice, setClientNotice] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setClients(readJsonArray<BillingClientProfile>(billingClientsStorageKey));
  }, []);

  const matchingClients = useMemo(() => {
    const name = normalizeClientName(clientName).toLowerCase();
    if (!name) return [];

    return clients.filter((client) => client.clientName.toLowerCase().includes(name));
  }, [clientName, clients]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;

  function saveClients(nextClients: BillingClientProfile[]) {
    setClients(nextClients);
    writeJsonArray(billingClientsStorageKey, nextClients);
  }

  function selectClient(client: BillingClientProfile) {
    setSelectedClientId(client.id);
    setClientName(client.clientName);
    setLegalAidNumber(client.legalAidNumber);
    setFamNumber(client.famNumber);
    setClientNotice(`Loaded ${client.clientName}'s billing profile.`);
  }

  function saveOrUpdateClientProfile() {
    const normalizedName = normalizeClientName(clientName);
    if (!normalizedName || !legalAidNumber.trim()) {
      setClientNotice("Enter the client name and legal aid number before saving a billing profile.");
      return null;
    }

    const existing = selectedClient ?? clients.find((client) =>
      client.clientName.toLowerCase() === normalizedName.toLowerCase(),
    );
    const now = new Date().toISOString();
    const profile = existing
      ? {
          ...existing,
          clientName: normalizedName,
          legalAidNumber: legalAidNumber.trim(),
          famNumber: famNumber.trim(),
          updatedAt: now,
        }
      : createClientProfile(normalizedName, legalAidNumber, famNumber);
    const nextClients = existing
      ? clients.map((client) => (client.id === existing.id ? profile : client))
      : [...clients, profile];

    saveClients(nextClients);
    setSelectedClientId(profile.id);
    setClientNotice(existing ? "Updated the billing profile." : "Created a new billing profile.");
    return profile;
  }

  function readForm33ASettings(): Form33ARuleSettings | null {
    const storedSettings = window.localStorage.getItem(form33ASettingsStorageKey);
    if (!storedSettings) return null;

    try {
      return JSON.parse(storedSettings) as Form33ARuleSettings;
    } catch {
      window.localStorage.removeItem(form33ASettingsStorageKey);
      return null;
    }
  }

  function readForm32BSettings(): Form32BRuleSettings | null {
    const storedSettings = window.localStorage.getItem(form32BSettingsStorageKey);
    if (!storedSettings) return null;

    try {
      return JSON.parse(storedSettings) as Form32BRuleSettings;
    } catch {
      window.localStorage.removeItem(form32BSettingsStorageKey);
      return null;
    }
  }

  function applyDraftTokens(wording: string, draft: BillingDraft): string {
    const attendanceTime = draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime}` : "";

    return wording
      .replace(/\[billing date\]/gi, draft.date)
      .replace(/\[attendance time\]/gi, attendanceTime)
      .replace(/\[court\]/gi, draft.court);
  }

  function buildConfiguredWording(record: BillingRecord): string {
    const isForm33A = record.formType === "33A";
    const settings = isForm33A ? readForm33ASettings() : readForm32BSettings();
    const rules = isForm33A ? form33AManagementRules : form32BManagementRules;
    const ruleMap = isForm33A ? categoryPrimaryRuleMap : form32BCategoryPrimaryRuleMap;
    const categories = record.draft.categories?.length ? record.draft.categories : [record.draft.category];

    return categories
      .map((category) => {
        const ruleId = ruleMap[category];
        const configuredWording = ruleId ? settings?.wordingByRuleId[ruleId] : "";
        const fallbackWording = ruleId
          ? rules.find((rule) => rule.id === ruleId)?.standardWording
          : "";
        const wording = configuredWording || fallbackWording;

        return wording ? applyDraftTokens(wording, record.draft) : "";
      })
      .filter((wording, index, wordings) => wording.trim() && wordings.indexOf(wording) === index)
      .join("\n\n");
  }

  function applyFormSettings(record: BillingRecord): BillingRecord {
    const standardWording = buildConfiguredWording(record);

    if (!standardWording) return record;

    const draft = {
      ...record.draft,
      standardWording: applyDraftTokens(standardWording, record.draft),
    };

    return {
      ...record,
      draft,
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const profile = saveOrUpdateClientProfile();
    if (!profile) return;

    setIsLoading(true);
    setError("");

    try {
      const invoiceNumber = formatInvoiceNumber(new Date().toISOString().slice(0, 10), formType, profile.clientName);
      const response = await fetch("/api/draft-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          formType,
          matter: {
            matterId: profile.id,
            clientName: profile.clientName,
            legalAidNumber: profile.legalAidNumber,
            invoiceNumber,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create billing draft.");
      }

      const nextRecord = applyFormSettings(payload.record as BillingRecord);
      setSelectedRecord(nextRecord);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create billing draft.");
    } finally {
      setIsLoading(false);
    }
  }

  function markEvidenceUploaded(recordId: string, evidenceType: string) {
    updateBillingRecord(recordId, (record) => {
      if (record.id !== recordId) return record;

      const evidence = record.evidence.map((requirement) =>
        requirement.type === evidenceType ? { ...requirement, uploaded: true } : requirement,
      );
      const status: BillingStatus = evidence.some((requirement) => !requirement.uploaded)
        ? "pending_evidence"
        : "ready_to_review";
      const updatedRecord: BillingRecord = {
        ...record,
        status,
        evidence,
        evidenceStoragePaths: Array.from(new Set([...record.evidenceStoragePaths, `pending-upload/${evidenceType}`])),
        draft: {
          ...record.draft,
          status,
          evidenceRequirements: evidence,
        },
        updatedAt: new Date().toISOString(),
      };

      return updatedRecord;
    });
  }

  function updateBillingRecord(recordId: string, updater: (record: BillingRecord) => BillingRecord) {
    if (!selectedRecord || selectedRecord.id !== recordId) return;
    setSelectedRecord(updater(selectedRecord));
  }

  function updateDetectedCategories(recordId: string, category: BillingCategory, checked: boolean) {
    updateBillingRecord(recordId, (record) => {
      const currentCategories = record.draft.categories?.length ? record.draft.categories : [record.draft.category];
      const nextCategories = checked
        ? Array.from(new Set([...currentCategories.filter((item) => item !== "general_billing_entry"), category]))
        : currentCategories.filter((item) => item !== category);
      const categories = nextCategories.length ? nextCategories : ["general_billing_entry" as BillingCategory];
      const categoryLabelsForDraft = categories.map((item) => categoryLabels[item]);
      const nextRecord: BillingRecord = {
        ...record,
        draft: {
          ...record.draft,
          category: categories[0],
          categoryLabel: categoryLabelsForDraft[0],
          categories,
          categoryLabels: categoryLabelsForDraft,
        },
        updatedAt: new Date().toISOString(),
      };

      return applyFormSettings(nextRecord);
    });
  }

  function updateDraftField(recordId: string, field: EditableBillingDraftField, value: string | number) {
    updateBillingRecord(recordId, (record) => {
      if (record.id !== recordId) return record;

      const draft = {
        ...record.draft,
        [field]: value,
        travel:
          field === "court"
            ? travelReferences.find((reference) => reference.court === String(value))
            : record.draft.travel,
      } as BillingDraft;

      return {
        ...record,
        clientName: field === "clientName" ? String(value) : record.clientName,
        legalAidNumber: field === "legalAidNumber" ? String(value) : record.legalAidNumber,
        invoiceNumber: field === "invoiceNumber" ? String(value) : record.invoiceNumber,
        draft,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function generateBillingDocument(record: BillingRecord) {
    setIsGenerating(true);
    setGenerationError("");
    setGenerationNotice("");

    try {
      const response = await fetch("/api/generate-billing-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, reviewed: true }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to generate billing document.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? `Completed Form${record.formType}.docx`;
      const invoiceTotal = Number(response.headers.get("X-Billing-Invoice-Total") ?? "0");
      const oneDriveStatus = response.headers.get("X-OneDrive-Status") ?? "not_configured";
      const oneDriveUrl = decodeURIComponent(response.headers.get("X-OneDrive-Url") ?? "");
      const oneDrivePath = decodeURIComponent(response.headers.get("X-OneDrive-Path") ?? "");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const profile = saveOrUpdateClientProfile();
      if (profile) {
        const invoice: StoredBillingInvoice = {
          id: record.id,
          clientId: profile.id,
          clientName: record.clientName,
          legalAidNumber: record.legalAidNumber,
          famNumber: profile.famNumber,
          invoiceNumber: record.invoiceNumber,
          invoiceTotal,
          formType: record.formType,
          status: oneDriveStatus === "uploaded" ? "onedrive_uploaded" : "onedrive_pending",
          oneDriveUrl,
          oneDrivePath,
          generatedFileName: fileName,
          generatedAt: new Date().toISOString(),
        };
        const invoices = readJsonArray<StoredBillingInvoice>(billingInvoicesStorageKey);
        writeJsonArray(
          billingInvoicesStorageKey,
          [invoice, ...invoices.filter((item) => item.id !== invoice.id)],
        );

        try {
          await fetch("/api/billing-records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(invoice),
          });
        } catch {
          // Browser storage remains the immediate source of truth until Supabase env vars are configured.
        }
      }

      setGenerationNotice(
        oneDriveStatus === "uploaded"
          ? "Generated, uploaded to OneDrive, and recorded in the invoice register."
          : "Generated and recorded locally. OneDrive upload will activate once Microsoft Graph credentials are configured.",
      );
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Unable to generate billing document.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/billing-management/form-32b"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Form32B management
            </Link>
            <Link
              href="/clients"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Clients
            </Link>
            <Link
              href="/invoices"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              Invoices
            </Link>
            <span className="rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              Forms 32B / 33A generation
            </span>
          </div>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal aid billing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Billing Workbench</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Enter the billing note, choose the form, review the extracted billing entry, then generate the Word document.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            <h2 className="text-lg font-semibold text-slate-950">Billing prompt</h2>

            <section className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Client billing profile</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Billing is separate from form production. First invoice creates or updates the client profile used for future bills.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={saveOrUpdateClientProfile}
                >
                  Save profile
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <Field label="Client name" value={clientName} onChange={(value) => {
                  setSelectedClientId("");
                  setClientName(value);
                }} />
                <Field label="Legal aid number" value={legalAidNumber} onChange={setLegalAidNumber} />
                <Field label="FAM number" value={famNumber} onChange={setFamNumber} />
              </div>
              {matchingClients.length && !selectedClient ? (
                <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold text-sky-950">Existing clients found</p>
                  <div className="mt-2 space-y-2">
                    {matchingClients.slice(0, 4).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="block w-full rounded-md bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        onClick={() => selectClient(client)}
                      >
                        {client.clientName} | Legal aid {client.legalAidNumber || "not supplied"} | FAM {client.famNumber || "not supplied"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {clientNotice ? <p className="mt-3 text-xs font-medium text-slate-600">{clientNotice}</p> : null}
            </section>

            <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="prompt">
              Lawyer note
            </label>
            <textarea
              id="prompt"
              className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-slate-700">Form</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <FormChoice label="32B" selected={formType === "32B"} onSelect={() => setFormType("32B")} />
                <FormChoice label="33A" selected={formType === "33A"} onSelect={() => setFormType("33A")} />
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading ? "Creating draft..." : "Generate billing draft"}
            </button>

            {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

            {selectedRecord ? (
              <DetectedWorkPanel
                record={selectedRecord}
                onCategoryChange={updateDetectedCategories}
              />
            ) : null}
          </form>

          <div className="space-y-6">
            {selectedRecord ? (
              <>
                <DraftPanel
                  record={selectedRecord}
                  generationError={generationError}
                  generationNotice={generationNotice}
                  isGenerating={isGenerating}
                  onDraftFieldChange={updateDraftField}
                  onEvidenceUploaded={markEvidenceUploaded}
                  onGenerate={generateBillingDocument}
                />
              </>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <input
        id={id}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FormChoice({
  label,
  selected,
  onSelect,
}: {
  label: BillingFormType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={selected
      ? "flex h-11 cursor-pointer items-center justify-center rounded-md border border-sky-500 bg-sky-50 text-sm font-semibold text-sky-800"
      : "flex h-11 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"}
    >
      <input
        type="radio"
        name="form-type"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      Form {label}
    </label>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-form">
      <h2 className="text-lg font-semibold text-slate-950">No draft yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Enter a billing note and generate a draft to review the identified work, client details, wording, disbursements, and evidence status.
      </p>
    </div>
  );
}

function DetectedWorkPanel({
  record,
  onCategoryChange,
}: {
  record: BillingRecord;
  onCategoryChange: (recordId: string, category: BillingCategory, checked: boolean) => void;
}) {
  const selectedCategories = record.draft.categories?.length ? record.draft.categories : [record.draft.category];

  return (
    <section className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">Identified work</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          Review before generating
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {reviewableCategories.map((item) => (
          <label
            key={item.category}
            className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={selectedCategories.includes(item.category)}
              onChange={(event) => onCategoryChange(record.id, item.category, event.target.checked)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </section>
  );
}

function DraftPanel({
  record,
  generationError,
  generationNotice,
  isGenerating,
  onDraftFieldChange,
  onEvidenceUploaded,
  onGenerate,
}: {
  record: BillingRecord;
  generationError: string;
  generationNotice: string;
  isGenerating: boolean;
  onDraftFieldChange: (recordId: string, field: EditableBillingDraftField, value: string | number) => void;
  onEvidenceUploaded: (recordId: string, evidenceType: string) => void;
  onGenerate: (record: BillingRecord) => void;
}) {
  const draft = record.draft;
  const totals = calculateBillingTotals(record);

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Review and generate</h2>
            <p className="mt-1 text-sm text-slate-600">Form {draft.formType} | {(draft.categoryLabels?.length ? draft.categoryLabels : [draft.categoryLabel]).join(", ")}</p>
          </div>
          <span className={draft.status === "pending_evidence" ? "rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900" : "rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"}>
            {draft.status === "pending_evidence" ? "Pending evidence" : "Ready to review"}
          </span>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail label="Client" value={draft.clientName || "Not identified"} />
          <Detail label="Legal aid number" value={draft.legalAidNumber || "Not supplied"} />
          <Detail label="Invoice number" value={draft.invoiceNumber || "Not supplied"} />
          <Detail label="Invoice total" value={`$${totals.total.toFixed(2)}`} />
          <Detail label="Court" value={draft.court || "Not identified"} />
          <Detail label="Date" value={draft.date} />
          <Detail label="Attendance" value={draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime} (${draft.attendanceHours}h)` : "Not identified"} />
          <Detail label="Disbursements" value={`Parking $${draft.parking.toFixed(2)} | Office $${draft.officeDisbursements.toFixed(2)}`} />
        </dl>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Client name"
            value={draft.clientName}
            onChange={(value) => onDraftFieldChange(record.id, "clientName", value)}
          />
          <Field
            label="Legal aid number"
            value={draft.legalAidNumber}
            onChange={(value) => onDraftFieldChange(record.id, "legalAidNumber", value)}
          />
          <Field
            label="Invoice number"
            value={draft.invoiceNumber}
            onChange={(value) => onDraftFieldChange(record.id, "invoiceNumber", value)}
          />
          <Field
            label="Court"
            value={draft.court}
            onChange={(value) => onDraftFieldChange(record.id, "court", value)}
          />
          <Field
            label="Billing date"
            value={draft.date}
            onChange={(value) => onDraftFieldChange(record.id, "date", value)}
          />
          <Field
            label="Start time"
            value={draft.startTime}
            onChange={(value) => onDraftFieldChange(record.id, "startTime", value)}
          />
          <Field
            label="End time"
            value={draft.endTime}
            onChange={(value) => onDraftFieldChange(record.id, "endTime", value)}
          />
          <NumberField
            label="Attendance hours"
            value={draft.attendanceHours}
            onChange={(value) => onDraftFieldChange(record.id, "attendanceHours", value)}
          />
          <NumberField
            label="Parking"
            value={draft.parking}
            onChange={(value) => onDraftFieldChange(record.id, "parking", value)}
          />
          <NumberField
            label="Office disbursements"
            value={draft.officeDisbursements}
            onChange={(value) => onDraftFieldChange(record.id, "officeDisbursements", value)}
          />
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="standard-wording">
          Word form wording
          <textarea
            id="standard-wording"
            className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            value={draft.standardWording}
            onChange={(event) => onDraftFieldChange(record.id, "standardWording", event.target.value)}
          />
        </label>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This is the reviewed wording that will be inserted into the Word form. Edit it here before generating the document.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Evidence checklist</h2>
        {draft.evidenceRequirements.length ? (
          <div className="mt-4 space-y-2">
            {draft.evidenceRequirements.map((requirement) => (
              <div key={requirement.type} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{requirement.label}</span>
                {requirement.uploaded ? (
                  <span className="text-xs font-semibold text-emerald-700">Received</span>
                ) : (
                  <button
                    type="button"
                    className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                    onClick={() => onEvidenceUploaded(record.id, requirement.type)}
                  >
                    Mark received
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No supporting evidence was inferred from this prompt.</p>
        )}

        {draft.warnings.length ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="text-sm font-semibold text-amber-950">Review flags</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Template status</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{draft.templateStatus}</p>
        <p className="mt-2 text-sm font-medium text-slate-700">Template path: {record.templatePath}</p>
        <button
          type="button"
          disabled={isGenerating}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={() => onGenerate(record)}
        >
          {isGenerating ? "Generating..." : `Generate reviewed Form ${record.formType}`}
        </button>
        {generationError ? <p className="mt-3 text-sm font-medium text-red-700">{generationError}</p> : null}
        {generationNotice ? <p className="mt-3 text-sm font-medium text-emerald-700">{generationNotice}</p> : null}
      </section>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        step="0.01"
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
    </div>
  );
}
