"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const affidavitOrderTypes = [
  "Protection Order",
  "Parenting Order",
  "Tenancy Order",
  "Order Preventing Removal from New Zealand",
  "Warrant",
  "Additional Guardian",
] as const;

type ChildDetails = {
  fullName: string;
  age: string;
  dateOfBirth: string;
  applicantRelationshipToChild: string;
  respondentRelationshipToChild: string;
  livingWithName: string;
};

type DraftForm = {
  applicantName: string;
  respondentName: string;
  selectedOrders: string[];
  ordersSought: string;
  protectedPersons: string;
  protectionOrderFacts: string;
  parentingProposal: string;
  preventingRemovalFacts: string;
  tenancyOrderFacts: string;
  warrantFacts: string;
  additionalGuardianFacts: string;
  historyNotes: string;
  recentEventsNotes: string;
  children: ChildDetails[];
};

const emptyChild: ChildDetails = {
  fullName: "",
  age: "",
  dateOfBirth: "",
  applicantRelationshipToChild: "",
  respondentRelationshipToChild: "",
  livingWithName: "",
};

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

export default function AffidavitWorkbenchPage() {
  const [form, setForm] = useState<DraftForm>({
    applicantName: "",
    respondentName: "",
    selectedOrders: [],
    ordersSought: "",
    protectedPersons: "",
    protectionOrderFacts: "",
    parentingProposal: "",
    preventingRemovalFacts: "",
    tenancyOrderFacts: "",
    warrantFacts: "",
    additionalGuardianFacts: "",
    historyNotes: "",
    recentEventsNotes: "",
    children: [{ ...emptyChild }],
  });
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  const updateField = <T extends keyof DraftForm>(field: T, value: DraftForm[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleOrder = (order: string) => {
    setForm((current) => ({
      ...current,
      selectedOrders: current.selectedOrders.includes(order)
        ? current.selectedOrders.filter((item) => item !== order)
        : [...current.selectedOrders, order],
    }));
  };

  const updateChild = (
    childIndex: number,
    field: keyof ChildDetails,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      children: current.children.map((child, index) =>
        index === childIndex ? { ...child, [field]: value } : child,
      ),
    }));
  };

  useEffect(() => {
    const hasContent =
      form.selectedOrders.length > 0 ||
      Object.entries(form).some(([key, value]) => {
        if (key === "selectedOrders" || key === "children") {
          return false;
        }

        return typeof value === "string" && value.trim().length > 0;
      }) ||
      form.children.some((child) =>
        Object.values(child).some((value) => value.trim().length > 0),
      );

    if (!hasContent) {
      setDraft("");
      setStatus("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setStatus("Drafting...");

      try {
        const response = await fetch("/api/draft-affidavit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Drafting failed");
        }

        const data = (await response.json()) as { draft?: string; source?: string };
        setDraft(data.draft ?? "");
        setStatus(data.source === "openai" ? "AI draft" : "Structured preview");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("Draft could not be updated.");
        }
      }
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [form]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/new-client"
            className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
          >
            Back to intake
          </Link>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Affidavit Workbench
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Domestic Violence Affidavit Draft
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <section className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">
                Parties and Orders
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Applicant"
                  value={form.applicantName}
                  onChange={(value) => updateField("applicantName", value)}
                />
                <Field
                  label="Respondent"
                  value={form.respondentName}
                  onChange={(value) => updateField("respondentName", value)}
                />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {affidavitOrderTypes.map((order) => (
                  <label
                    key={order}
                    className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedOrders.includes(order)}
                      onChange={() => toggleOrder(order)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>{order}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">Children</h2>
              <div className="mt-5 space-y-4">
                {form.children.map((child, index) => (
                  <div key={index} className="rounded-md border border-slate-200 p-4">
                    <h3 className="mb-4 text-sm font-semibold text-slate-950">
                      Child {index + 1}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="Full Name"
                        value={child.fullName}
                        onChange={(value) => updateChild(index, "fullName", value)}
                      />
                      <Field
                        label="Age"
                        value={child.age}
                        onChange={(value) => updateChild(index, "age", value)}
                      />
                      <Field
                        label="Date of Birth"
                        value={child.dateOfBirth}
                        onChange={(value) => updateChild(index, "dateOfBirth", value)}
                        placeholder="DD/MM/YYYY"
                      />
                      <Field
                        label="Living With"
                        value={child.livingWithName}
                        onChange={(value) => updateChild(index, "livingWithName", value)}
                      />
                      <Field
                        label="Applicant Relationship"
                        value={child.applicantRelationshipToChild}
                        onChange={(value) =>
                          updateChild(index, "applicantRelationshipToChild", value)
                        }
                      />
                      <Field
                        label="Respondent Relationship"
                        value={child.respondentRelationshipToChild}
                        onChange={(value) =>
                          updateChild(index, "respondentRelationshipToChild", value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => updateField("children", [...form.children, { ...emptyChild }])}
                className="mt-4 h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-slate-50"
              >
                Add Child
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">
                Affidavit Sections
              </h2>
              <div className="mt-5 space-y-4">
                <TextArea
                  label="Orders Sought"
                  value={form.ordersSought}
                  onChange={(value) => updateField("ordersSought", value)}
                  placeholder="List exactly what is being applied for."
                />
                <TextArea
                  label="Protected Persons"
                  value={form.protectedPersons}
                  onChange={(value) => updateField("protectedPersons", value)}
                  placeholder="Only complete if protected persons are sought."
                />
                <TextArea
                  label="Protection Order Facts"
                  value={form.protectionOrderFacts}
                  onChange={(value) => updateField("protectionOrderFacts", value)}
                />
                <TextArea
                  label="Parenting Proposal"
                  value={form.parentingProposal}
                  onChange={(value) => updateField("parentingProposal", value)}
                  placeholder="Day-to-day care and contact proposal."
                />
                <TextArea
                  label="Preventing Removal Facts"
                  value={form.preventingRemovalFacts}
                  onChange={(value) => updateField("preventingRemovalFacts", value)}
                />
                <TextArea
                  label="Tenancy Order Facts"
                  value={form.tenancyOrderFacts}
                  onChange={(value) => updateField("tenancyOrderFacts", value)}
                />
                <TextArea
                  label="Warrant Facts"
                  value={form.warrantFacts}
                  onChange={(value) => updateField("warrantFacts", value)}
                />
                <TextArea
                  label="Additional Guardian Facts"
                  value={form.additionalGuardianFacts}
                  onChange={(value) => updateField("additionalGuardianFacts", value)}
                />
                <TextArea
                  label="History of Family Violence Notes"
                  value={form.historyNotes}
                  onChange={(value) => updateField("historyNotes", value)}
                  rows={8}
                />
                <TextArea
                  label="Recent Events Notes"
                  value={form.recentEventsNotes}
                  onChange={(value) => updateField("recentEventsNotes", value)}
                  rows={8}
                />
              </div>
            </div>
          </section>

          <aside className="sticky top-6 h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Draft Preview</h2>
              {status ? <span className="text-xs font-medium text-sky-700">{status}</span> : null}
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={34}
              className="w-full resize-y rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none"
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
