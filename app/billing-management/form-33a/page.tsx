"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import type { BillingRecord } from "../../../lib/billing-automation";
import {
  form33AFeeRules,
  form33AManagementRules,
  type Form33AManagementRule,
} from "../../../lib/form33a-rules";

const examplePrompt = "judicial conference from 11:00am-11:30am at waitakere court";

const demoMatter = {
  matterId: "matter-demo-phillip-jones",
  clientName: "Phillip Jones",
  legalAidNumber: "LA-DEMO-001",
  invoiceNumber: "",
  matterDetails: "COCA parenting proceedings",
  proceedingType: "COCA / parenting",
};

const categoryRuleMap: Record<string, string[]> = {
  judicial_conference: ["judicial-conference", "travel-time", "mileage"],
  pre_hearing_conference: ["judicial-conference", "travel-time", "mileage"],
  formal_proof: ["formal-proof", "travel-time", "mileage"],
  complying_judges_directions: ["judge-directions"],
  pre_hearing_matters: ["pre-hearing-matters"],
  defended_hearing: ["defended-hearing", "travel-time", "mileage"],
  defended_protection_order: ["defended-protection-order"],
  instructing_agent: ["instructing-agent"],
  additional_factors: ["additional-factors"],
};

export default function Form33AManagementPage() {
  const [prompt, setPrompt] = useState(examplePrompt);
  const [wordingByRuleId, setWordingByRuleId] = useState<Record<string, string>>(() =>
    Object.fromEntries(form33AManagementRules.map((rule) => [rule.id, rule.standardWording])),
  );
  const [testRecord, setTestRecord] = useState<BillingRecord | null>(null);
  const [testError, setTestError] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const groupedRules = useMemo(() => {
    return form33AManagementRules.reduce<Record<string, Form33AManagementRule[]>>((groups, rule) => {
      groups[rule.section] = [...(groups[rule.section] ?? []), rule];
      return groups;
    }, {});
  }, []);

  const activeRuleIds = testRecord ? categoryRuleMap[testRecord.draft.category] ?? [] : [];
  const activeRules = form33AManagementRules.filter((rule) => activeRuleIds.includes(rule.id));
  const activeWording = activeRules
    .map((rule) => wordingByRuleId[rule.id])
    .filter(Boolean)
    .join("\n\n");

  async function runPromptTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsTesting(true);
    setTestError("");

    try {
      const response = await fetch("/api/draft-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          formType: "33A",
          matter: demoMatter,
          uploadedEvidence: ["notice", "directions"],
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to test this prompt.");
      }

      setTestRecord(payload.record as BillingRecord);
    } catch (caughtError) {
      setTestError(caughtError instanceof Error ? caughtError.message : "Unable to test this prompt.");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Back to dashboard
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-sky-700">
              Billing management
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Form33A Rules
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Review pricing, placeholders, wording, GST treatment, and prompt behaviour before expanding the billing engine.
            </p>
          </div>
          <Link
            href="/billing"
            className="inline-flex h-10 items-center justify-center rounded-md border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
          >
            Open billing workbench
          </Link>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <Metric label="Template" value="Form33A" detail="Final uploaded Word structure" />
          <Metric label="GST" value={`${form33AFeeRules.gstRate * 100}%`} detail="Excludes mileage" />
          <Metric label="Mileage" value={`$${form33AFeeRules.mileageRatePerKm.toFixed(2)}/km`} detail="No GST" />
          <Metric label="Travel time" value={`$${form33AFeeRules.fixedFeePlusActivities.travelTimeHourlyRate}/hr`} detail="Needs final bucket confirmation" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            {Object.entries(groupedRules).map(([section, rules]) => (
              <section key={section} className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <h2 className="text-lg font-semibold text-slate-950">{section}</h2>
                  <span className="text-sm text-slate-500">{rules.length} rules</span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500">
                        <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Keyword</th>
                        <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Row</th>
                        <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Placeholders</th>
                        <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Pricing</th>
                        <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Bucket</th>
                        <th className="border-b border-slate-200 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id} className="align-top">
                          <td className="border-b border-slate-100 py-3 pr-4 font-medium text-slate-950">{rule.keyword}</td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{rule.formRow}</td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            <div className="flex max-w-sm flex-wrap gap-1">
                              {rule.placeholders.map((placeholder) => (
                                <code key={placeholder} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                                  {placeholder}
                                </code>
                              ))}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            <p>{rule.feeRule}</p>
                            <p className="mt-1 text-xs text-slate-500">{rule.quantityRule}</p>
                          </td>
                          <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                            <p>{rule.totalBucket}</p>
                            <p className="mt-1 text-xs text-slate-500">{rule.gstTreatment}</p>
                          </td>
                          <td className="border-b border-slate-100 py-3">
                            <StatusPill status={rule.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">Prompt tester</h2>
              <form onSubmit={runPromptTest} className="mt-4">
                <label className="block text-sm font-medium text-slate-700" htmlFor="test-prompt">
                  Test prompt
                </label>
                <textarea
                  id="test-prompt"
                  className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={isTesting}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isTesting ? "Testing..." : "Test Form33A prompt"}
                </button>
                {testError ? <p className="mt-3 text-sm font-medium text-red-700">{testError}</p> : null}
              </form>

              {testRecord ? (
                <div className="mt-5 space-y-3 rounded-md bg-slate-50 p-4">
                  <Detail label="Detected category" value={testRecord.draft.categoryLabel} />
                  <Detail label="Court" value={testRecord.draft.court || "Not identified"} />
                  <Detail label="Invoice" value={testRecord.invoiceNumber} />
                  <Detail label="Attendance" value={`${testRecord.draft.startTime}-${testRecord.draft.endTime} (${testRecord.draft.attendanceHours}h)`} />
                  <Detail label="Travel" value={testRecord.draft.travel ? `${testRecord.draft.travel.returnTravelTime}; ${testRecord.draft.travel.returnDistance}` : "No supported travel"} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Triggered rules</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeRules.map((rule) => (
                        <span key={rule.id} className="rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800">
                          {rule.formRow}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">Editable wording working copy</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                These edits are local to this review screen for now. Once Supabase is connected, this becomes saved configuration.
              </p>

              <div className="mt-4 space-y-4">
                {form33AManagementRules.map((rule) => (
                  <label key={rule.id} className="block text-sm font-medium text-slate-700" htmlFor={`wording-${rule.id}`}>
                    {rule.formRow}
                    <textarea
                      id={`wording-${rule.id}`}
                      className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={wordingByRuleId[rule.id] ?? ""}
                      onChange={(event) =>
                        setWordingByRuleId((current) => ({
                          ...current,
                          [rule.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">Wording preview</h2>
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {activeWording || "Run a prompt test to preview the wording rules that would apply."}
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-form">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Form33AManagementRule["status"] }) {
  const className =
    status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Partial"
        ? "bg-amber-100 text-amber-900"
        : "bg-rose-100 text-rose-800";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

