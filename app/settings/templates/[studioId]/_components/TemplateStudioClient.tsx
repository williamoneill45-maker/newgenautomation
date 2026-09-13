"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { demoMatter } from "../../../../../lib/demo-data";
import {
  applicationTypes,
  courts,
  familyViolenceTypes,
  type ApplicationType,
  type FamilyViolenceType,
  type MatterFile,
  type ProceedingsType,
} from "../../../../../lib/matter";
import type { TemplatePlaceholder } from "../../../../../lib/template-scanner";
import type { StudioTemplateDefinition } from "../../../../../lib/template-studio";

type Props = {
  template: StudioTemplateDefinition;
  previewText: string;
  placeholders: TemplatePlaceholder[];
  initialApplies: boolean;
  initialReason: string;
};

const protectionApplication = "Without Notice Application for Protection Order";
const parentingApplication = "Without Notice Application for Parenting Order";

function cloneDemoMatter(): MatterFile {
  return structuredClone(demoMatter);
}

function placeholderClass(status: TemplatePlaceholder["status"]) {
  if (status === "known") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (status === "legacy") return "border-sky-300 bg-sky-100 text-sky-950";
  if (status === "malformed") return "border-rose-300 bg-rose-100 text-rose-950";
  return "border-amber-300 bg-amber-100 text-amber-950";
}

function sourceClass(source: string) {
  if (source === "intake") return "bg-blue-100 text-blue-900";
  if (source === "workflow") return "bg-violet-100 text-violet-900";
  if (source === "drafting") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function inferPlaceholderSource(key: string) {
  if (/violence|affidavit|heading|blurb|intro|orders_sought/i.test(key)) return "workflow";
  if (/date|month|year|age|name_upper|court_location/i.test(key)) return "derived";
  return "intake";
}

function fieldValue(matter: MatterFile, key: string) {
  const lower = key.toLowerCase();
  if (lower.includes("applicant") && lower.includes("name")) return matter.intake.applicant.fullName;
  if (lower.includes("respondent") && lower.includes("name")) return matter.intake.respondent.fullName;
  if (lower.includes("court")) return matter.intake.courtLocation;
  if (lower.includes("fam")) return matter.intake.famNumber;
  if (lower.includes("legal_aid")) return matter.legalAidNumber;
  if (lower.includes("child_1")) return matter.intake.children[0]?.fullName ?? "";
  if (lower.includes("violence")) return matter.intake.familyViolenceTypes.join("; ");
  return "";
}

function hasProtection(matter: MatterFile) {
  return matter.intake.proceedingsType === "protection_order" || matter.intake.proceedingsType === "both";
}

function hasParenting(matter: MatterFile) {
  return matter.intake.proceedingsType === "care_of_children" || matter.intake.proceedingsType === "both";
}

function appliesToMatter(template: StudioTemplateDefinition, matter: MatterFile) {
  if (template.id === "parenting_order_application" && !hasParenting(matter)) {
    return { applies: false, reason: "Turn on Parenting Order to include this document." };
  }
  if (template.id === "protection_order_application" && !hasProtection(matter)) {
    return { applies: false, reason: "Turn on Protection Order to include this document." };
  }
  if (template.id === "confidential_address_application" && !matter.intake.applicant.isAddressConfidential) {
    return { applies: false, reason: "Turn on confidential address to include this document." };
  }
  return { applies: true, reason: "Included with the current fake intake settings." };
}

export function TemplateStudioClient({
  template,
  previewText,
  placeholders,
  initialApplies,
  initialReason,
}: Props) {
  const [matter, setMatter] = useState<MatterFile>(() => cloneDemoMatter());
  const [downloadStatus, setDownloadStatus] = useState("");
  const placeholderMap = useMemo(() => new Map(placeholders.map((placeholder) => [placeholder.raw, placeholder])), [placeholders]);
  const applicability = useMemo(() => appliesToMatter(template, matter), [template, matter]);
  const knownCount = placeholders.filter((placeholder) => placeholder.status === "known").length;
  const warningCount = placeholders.length - knownCount;

  const setProceedingsType = (proceedingsType: ProceedingsType) => {
    const selectedApplications: ApplicationType[] =
      proceedingsType === "both"
        ? [protectionApplication, parentingApplication]
        : proceedingsType === "protection_order"
          ? [protectionApplication]
          : proceedingsType === "care_of_children"
            ? [parentingApplication]
            : [];

    setMatter((current) => ({
      ...current,
      intake: {
        ...current.intake,
        proceedingsType,
        selectedApplications,
      },
    }));
  };

  const toggleApplication = (application: ApplicationType) => {
    setMatter((current) => {
      const selectedApplications = current.intake.selectedApplications.includes(application)
        ? current.intake.selectedApplications.filter((item) => item !== application)
        : [...current.intake.selectedApplications, application];

      return {
        ...current,
        intake: {
          ...current.intake,
          selectedApplications,
        },
      };
    });
  };

  const toggleViolence = (violenceType: FamilyViolenceType) => {
    setMatter((current) => {
      const currentTypes = current.intake.familyViolenceTypes;
      const familyViolenceTypes = currentTypes.includes(violenceType)
        ? currentTypes.filter((item) => item !== violenceType)
        : [...currentTypes, violenceType];

      return {
        ...current,
        intake: {
          ...current.intake,
          familyViolenceTypes,
        },
      };
    });
  };

  const setChildCount = (count: number) => {
    setMatter((current) => {
      const children = [...current.intake.children];
      while (children.length < count) {
        const number = children.length + 1;
        children.push({
          id: `studio-child-${number}`,
          matterId: current.id,
          fullName: `CHILD ${number} THOMPSON`,
          age: String(10 - number),
          dateOfBirth: `201${number}-01-0${number}`,
          gender: number % 2 ? "F" : "M",
          livingWithName: current.intake.applicant.fullName,
          livingWithRelationshipToChild: "Mother",
          applicantRelationshipToChild: "Mother",
          respondentRelationshipToChild: "Father",
          ethnicity: "New Zealand European",
          otherEthnicity: "",
        });
      }

      return {
        ...current,
        intake: {
          ...current.intake,
          children: children.slice(0, count),
        },
      };
    });
  };

  const testTemplate = async () => {
    setDownloadStatus("Generating test document...");
    const response = await fetch("/api/templates/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studioId: template.studioId, matter }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unable to test this template." }));
      setDownloadStatus(payload.error ?? "Unable to test this template.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TEST ${template.outputFileName}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloadStatus("Downloaded test document using the fake intake.");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-form">
            <Link href="/settings/templates" className="text-sm font-semibold text-sky-700 transition hover:text-sky-900">
              Back to templates
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-sky-700">Fake Intake</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Template Studio</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Uses Sarah Thompson by default. Toggle the intake settings here, then test-generate this template.
            </p>
          </div>

          <Panel title="Matter">
            <TextInput label="Applicant" value={matter.intake.applicant.fullName} onChange={(value) => setMatter((current) => ({
              ...current,
              clientName: value,
              intake: { ...current.intake, applicant: { ...current.intake.applicant, fullName: value } },
            }))} />
            <TextInput label="Respondent" value={matter.intake.respondent.fullName} onChange={(value) => setMatter((current) => ({
              ...current,
              intake: { ...current.intake, respondent: { ...current.intake.respondent, fullName: value } },
            }))} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-900">Court</span>
              <select
                value={matter.intake.courtLocation}
                onChange={(event) => setMatter((current) => ({
                  ...current,
                  intake: { ...current.intake, courtLocation: event.target.value as MatterFile["intake"]["courtLocation"] },
                }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {courts.map((court) => <option key={court} value={court}>{court}</option>)}
              </select>
            </label>
            <TextInput label="FAM number" value={matter.intake.famNumber} onChange={(value) => setMatter((current) => ({
              ...current,
              intake: { ...current.intake, famNumber: value },
            }))} />
          </Panel>

          <Panel title="Applications">
            <select
              value={matter.intake.proceedingsType}
              onChange={(event) => setProceedingsType(event.target.value as ProceedingsType)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="protection_order">Protection Order</option>
              <option value="care_of_children">Parenting Order</option>
              <option value="both">Both</option>
            </select>
            <div className="space-y-2">
              {applicationTypes.slice(0, 6).map((application) => (
                <CheckRow
                  key={application}
                  label={application}
                  checked={matter.intake.selectedApplications.includes(application)}
                  onChange={() => toggleApplication(application)}
                />
              ))}
            </div>
            <CheckRow
              label="Confidential address"
              checked={Boolean(matter.intake.applicant.isAddressConfidential)}
              onChange={() => setMatter((current) => ({
                ...current,
                intake: {
                  ...current.intake,
                  applicant: {
                    ...current.intake.applicant,
                    isAddressConfidential: !current.intake.applicant.isAddressConfidential,
                  },
                },
              }))}
            />
            <CheckRow
              label="Fee waiver required"
              checked={matter.intake.feeWaiverRequired}
              onChange={() => setMatter((current) => ({
                ...current,
                intake: { ...current.intake, feeWaiverRequired: !current.intake.feeWaiverRequired },
              }))}
            />
          </Panel>

          <Panel title="Family Violence">
            {familyViolenceTypes.map((violenceType) => (
              <CheckRow
                key={violenceType}
                label={violenceType}
                checked={matter.intake.familyViolenceTypes.includes(violenceType)}
                onChange={() => toggleViolence(violenceType)}
              />
            ))}
          </Panel>

          <Panel title="Children">
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setChildCount(count)}
                  className={`rounded-md border px-3 py-2 text-sm font-semibold ${matter.intake.children.length === count ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="space-y-5">
          <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{template.sourceDescription}</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">{template.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{template.sourceFileName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={`${knownCount} known`} className="bg-emerald-100 text-emerald-900" />
                <StatusPill label={`${warningCount} to review`} className={warningCount ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"} />
                <StatusPill label={applicability.applies ? "Included" : "Excluded"} className={applicability.applies ? "bg-sky-100 text-sky-900" : "bg-slate-100 text-slate-700"} />
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={testTemplate}
                disabled={template.kind !== "docx" || !applicability.applies}
                className="h-10 rounded-md bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Test template
              </button>
              <p className="text-sm text-slate-600">
                {downloadStatus || applicability.reason || initialReason}
                {!initialApplies ? "" : ""}
              </p>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Template Preview</h3>
                  <p className="mt-1 text-sm text-slate-600">Placeholders are highlighted in the extracted template text.</p>
                </div>
              </div>
              <div className="mt-5 max-h-[760px] overflow-auto rounded-md border border-slate-200 bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                {template.kind === "docx" ? (
                  <PreviewText text={previewText} placeholderMap={placeholderMap} />
                ) : (
                  <div className="space-y-3 text-slate-200">
                    <p className="font-semibold text-white">PDF preview support is staged next.</p>
                    <p>This template is a PDF form. The next pass should show its fillable fields and fix the white-box appearance before flattening.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h3 className="text-lg font-semibold text-slate-950">Field Map</h3>
              <p className="mt-1 text-sm text-slate-600">Colour shows whether NewGen recognises each field.</p>
              <div className="mt-4 space-y-3">
                {placeholders.length === 0 ? (
                  <p className="text-sm text-slate-500">No DOCX placeholders found.</p>
                ) : placeholders.map((placeholder) => {
                  const source = inferPlaceholderSource(placeholder.canonicalKey ?? placeholder.key);
                  return (
                    <div key={placeholder.raw} className="rounded-md border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className={`rounded border px-1.5 py-0.5 text-xs ${placeholderClass(placeholder.status)}`}>{placeholder.raw}</code>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${sourceClass(source)}`}>{source}</span>
                      </div>
                      {placeholder.canonicalKey ? (
                        <p className="mt-2 text-xs text-slate-600">Use {`{{${placeholder.canonicalKey}}}`}</p>
                      ) : null}
                      {placeholder.issue ? <p className="mt-2 text-xs text-slate-600">{placeholder.issue}</p> : null}
                      <p className="mt-2 text-xs text-slate-500">Fake value: {fieldValue(matter, placeholder.canonicalKey ?? placeholder.key) || "auto / blank"}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function PreviewText({ text, placeholderMap }: { text: string; placeholderMap: Map<string, TemplatePlaceholder> }) {
  const parts = text.split(/(\{\{[^{}]+\}\}|\{\{[^{}\n]*|\}\})/g);

  return (
    <pre className="whitespace-pre-wrap font-mono">
      {parts.map((part, index) => {
        const placeholder = placeholderMap.get(part);
        if (!placeholder) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <span key={`${part}-${index}`} className={`rounded border px-1 py-0.5 ${placeholderClass(placeholder.status)}`}>
            {part}
          </span>
        );
      })}
    </pre>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-form">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-900">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      />
    </label>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}
