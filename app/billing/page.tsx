"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  travelReferences,
  type BillingDraft,
  type BillingFormType,
  type BillingRecord,
  type BillingStatus,
} from "../../lib/billing-automation";

const examplePrompt =
  "Pre-hearing conference from 11:00am-11:30am at Waitakere Court, use form 33a.";

const emptyMatter = {
  matterId: "matter-demo-phillip-jones",
  clientName: "Phillip Jones",
  legalAidNumber: "LA-DEMO-001",
  invoiceNumber: "",
  matterDetails: "COCA parenting proceedings",
  proceedingType: "COCA / parenting",
};

const billingHistoryStorageKey = "newgenautomation.billing.records";

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

export default function BillingPage() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const [formType, setFormType] = useState<BillingFormType>("33A");
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const storedRecords = window.localStorage.getItem(billingHistoryStorageKey);
    if (!storedRecords) return;

    try {
      const parsedRecords = JSON.parse(storedRecords) as BillingRecord[];
      setRecords(parsedRecords);
      setSelectedRecord(parsedRecords[0] ?? null);
    } catch {
      window.localStorage.removeItem(billingHistoryStorageKey);
    }
  }, []);

  function saveRecords(nextRecords: BillingRecord[]) {
    setRecords(nextRecords);
    window.localStorage.setItem(billingHistoryStorageKey, JSON.stringify(nextRecords));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/draft-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, formType, matter: emptyMatter }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create billing draft.");
      }

      const nextRecord = payload.record as BillingRecord;
      const nextRecords = [nextRecord, ...records.filter((record) => record.id !== nextRecord.id)];
      saveRecords(nextRecords);
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
    const nextRecords = records.map((record) => (record.id === recordId ? updater(record) : record));
    saveRecords(nextRecords);
    setSelectedRecord(nextRecords.find((record) => record.id === recordId) ?? selectedRecord);
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
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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
          <span className="rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            Forms 32B / 33A generation
          </span>
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
          </form>

          <div className="space-y-6">
            {selectedRecord ? (
              <>
                <DraftPanel
                  record={selectedRecord}
                  generationError={generationError}
                  isGenerating={isGenerating}
                  onDraftFieldChange={updateDraftField}
                  onEvidenceUploaded={markEvidenceUploaded}
                  onGenerate={generateBillingDocument}
                />
                <HistoryPanel
                  records={records}
                  selectedRecordId={selectedRecord.id}
                  onSelect={setSelectedRecord}
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
        Enter a billing note and generate a draft to see the extracted matter, form, wording, travel, disbursements, and evidence status.
      </p>
    </div>
  );
}

function DraftPanel({
  record,
  generationError,
  isGenerating,
  onDraftFieldChange,
  onEvidenceUploaded,
  onGenerate,
}: {
  record: BillingRecord;
  generationError: string;
  isGenerating: boolean;
  onDraftFieldChange: (recordId: string, field: EditableBillingDraftField, value: string | number) => void;
  onEvidenceUploaded: (recordId: string, evidenceType: string) => void;
  onGenerate: (record: BillingRecord) => void;
}) {
  const draft = record.draft;

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Draft billing entry</h2>
            <p className="mt-1 text-sm text-slate-600">Form {draft.formType} | {draft.categoryLabel}</p>
          </div>
          <span className={draft.status === "pending_evidence" ? "rounded-md bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900" : "rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"}>
            {draft.status === "pending_evidence" ? "Pending evidence" : "Ready to review"}
          </span>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail label="Client" value={draft.clientName || "Not identified"} />
          <Detail label="Legal aid number" value={draft.legalAidNumber || "Not supplied"} />
          <Detail label="Invoice number" value={draft.invoiceNumber || "Not supplied"} />
          <Detail label="Court" value={draft.court || "Not identified"} />
          <Detail label="Date" value={draft.date} />
          <Detail label="Attendance" value={draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime} (${draft.attendanceHours}h)` : "Not identified"} />
          <Detail label="Disbursements" value={`Parking $${draft.parking.toFixed(2)} | Office $${draft.officeDisbursements.toFixed(2)}`} />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Review and edit</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
          Controlled wording
          <textarea
            id="standard-wording"
            className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            value={draft.standardWording}
            onChange={(event) => onDraftFieldChange(record.id, "standardWording", event.target.value)}
          />
        </label>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Travel calculation</h2>
        {draft.travel ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Detail label="Court" value={draft.travel.court} />
            <Detail label="Return travel" value={draft.travel.returnTravelTime} />
            <Detail label="Travel time row" value={draft.travel.travelTimeBillingRow} />
            <Detail label="Travel time value" value={String(draft.travel.travelTimeValue)} />
            <Detail label="Mileage row" value={draft.travel.mileageBillingRow} />
            <Detail label="Mileage value" value={String(draft.travel.mileageValue)} />
            <Detail label="Return distance" value={draft.travel.returnDistance} />
            <Detail label="Progress/results" value={draft.travel.progressResultsWording} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No supported travel reference matched this prompt. Supported courts are Manukau Court, Auckland Court,
            North Shore Court, and Waitakere Court.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Controlled wording</h2>
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {draft.standardWording}
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

function HistoryPanel({
  records,
  selectedRecordId,
  onSelect,
}: {
  records: BillingRecord[];
  selectedRecordId: string;
  onSelect: (record: BillingRecord) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-950">Billing history</h2>
        <span className="text-sm text-slate-500">{records.length} saved</span>
      </div>

      <div className="mt-4 space-y-2">
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            className={record.id === selectedRecordId
              ? "w-full rounded-md border border-sky-300 bg-sky-50 p-3 text-left transition"
              : "w-full rounded-md border border-slate-200 p-3 text-left transition hover:bg-slate-50"}
            onClick={() => onSelect(record)}
          >
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-semibold text-slate-950">{record.clientName || "Unknown client"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Form {record.formType} | {new Date(record.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={record.status === "pending_evidence" ? "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900" : "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900"}>
                {record.status === "pending_evidence" ? "Pending evidence" : "Ready"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
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
