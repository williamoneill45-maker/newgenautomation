"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { BillingDraft } from "../../lib/billing-automation";

const examplePrompt =
  "I attended a pre hearing conference today at Waitakere Court for Phillip Jones from 12pm-1pm, parking was $12.50, office disbursements of $15, use form 32b.";

const emptyMatter = {
  clientName: "Phillip Jones",
  legalAidNumber: "",
  invoiceNumber: "",
  matterDetails: "COCA parenting proceedings",
  proceedingType: "COCA / parenting",
};

export default function BillingPage() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const [matter, setMatter] = useState(emptyMatter);
  const [draft, setDraft] = useState<BillingDraft | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setDraft(null);

    try {
      const response = await fetch("/api/draft-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, matter }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create billing draft.");
      }

      setDraft(payload.draft);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create billing draft.");
    } finally {
      setIsLoading(false);
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
            Forms 32B / 33A phase 1
          </span>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal aid billing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Billing Workbench</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Create a structured billing draft from a lawyer note, using controlled wording and stored travel references.
            Exact Form 32B and 33A merging will switch on once the legacy .dot forms are uploaded as editable .docx or .dotx templates with placeholders.
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

            <div className="mt-6 grid gap-4">
              <Field
                label="Client name"
                value={matter.clientName}
                onChange={(value) => setMatter((current) => ({ ...current, clientName: value }))}
              />
              <Field
                label="Legal aid number"
                value={matter.legalAidNumber}
                onChange={(value) => setMatter((current) => ({ ...current, legalAidNumber: value }))}
              />
              <Field
                label="Invoice number"
                value={matter.invoiceNumber}
                onChange={(value) => setMatter((current) => ({ ...current, invoiceNumber: value }))}
              />
              <Field
                label="Matter details"
                value={matter.matterDetails}
                onChange={(value) => setMatter((current) => ({ ...current, matterDetails: value }))}
              />
              <Field
                label="Proceeding type"
                value={matter.proceedingType}
                onChange={(value) => setMatter((current) => ({ ...current, proceedingType: value }))}
              />
            </div>

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
            {draft ? <DraftPanel draft={draft} /> : <EmptyState />}
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

function DraftPanel({ draft }: { draft: BillingDraft }) {
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
          <Detail label="Proceeding" value={draft.proceedingType} />
          <Detail label="Court" value={draft.court || "Not identified"} />
          <Detail label="Date" value={draft.date} />
          <Detail label="Attendance" value={draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime} (${draft.attendanceHours}h)` : "Not identified"} />
          <Detail label="Disbursements" value={`Parking $${draft.parking.toFixed(2)} | Office $${draft.officeDisbursements.toFixed(2)}`} />
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
        <h2 className="text-lg font-semibold text-slate-950">Travel calculation</h2>
        {draft.travel ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Detail label="Court" value={draft.travel.court} />
            <Detail label="Return mileage" value={`${draft.travel.returnKm} km`} />
            <Detail label="Return travel" value={`${draft.travel.returnTravelHours} hours`} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No stored travel reference matched this prompt.</p>
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
                <span className={requirement.uploaded ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-800"}>
                  {requirement.uploaded ? "Uploaded" : "Needed"}
                </span>
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
      </section>
    </>
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
