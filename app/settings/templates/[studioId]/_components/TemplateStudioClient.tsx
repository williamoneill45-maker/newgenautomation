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
} from "../../../../../lib/matter";
import {
  deriveNoticeType,
  deriveOrdersSought,
  getMatterApplicationSelection,
  noticeTypeLabels,
  noticeTypes,
  orderOptions,
  proceedingsTypeFromOrders,
  selectedApplicationsFromStructured,
  type NoticeType,
  type OrdersSought,
} from "../../../../../lib/application-orders";
import type { TemplatePlaceholder } from "../../../../../lib/template-scanner";
import type { TemplateManifest, TemplateVersionRecord } from "../../../../../lib/supabase-template-versions";
import type { StudioTemplateDefinition } from "../../../../../lib/template-studio";

type Props = {
  template: StudioTemplateDefinition;
  previewText: string;
  placeholders: TemplatePlaceholder[];
  manifest: TemplateManifest;
  initialApplies: boolean;
  initialReason: string;
};

type Tab = "document" | "fields" | "test-data" | "versions";

function cloneDemoMatter(): MatterFile {
  return structuredClone(demoMatter);
}

function placeholderClass(status: TemplatePlaceholder["status"]) {
  if (status === "known") return "border-emerald-300 bg-emerald-100 text-emerald-950";
  if (status === "legacy") return "border-sky-300 bg-sky-100 text-sky-950";
  if (status === "malformed") return "border-rose-300 bg-rose-100 text-rose-950";
  return "border-amber-300 bg-amber-100 text-amber-950";
}

function statusClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-900";
  if (status === "draft") return "bg-amber-100 text-amber-900";
  if (status === "archived") return "bg-slate-100 text-slate-700";
  return "bg-sky-100 text-sky-900";
}

function hasProtection(matter: MatterFile) {
  return deriveOrdersSought(matter.intake).protection;
}

function hasParenting(matter: MatterFile) {
  return deriveOrdersSought(matter.intake).parenting;
}

function hasAffidavitOrder(matter: MatterFile) {
  return orderOptions.some((option) => deriveOrdersSought(matter.intake)[option.key]);
}

function appliesToMatter(template: StudioTemplateDefinition, matter: MatterFile) {
  if (template.id === "parenting_order_application" && !hasParenting(matter)) return { applies: false, reason: "Turn on Parenting Order to include this document." };
  if (template.id === "protection_order_application" && !hasProtection(matter)) return { applies: false, reason: "Turn on Protection Order to include this document." };
  if (template.id === "domestic_violence_affidavit" && !hasAffidavitOrder(matter)) return { applies: false, reason: "Select at least one order to include the affidavit." };
  if (template.id === "confidential_address_application" && !matter.intake.applicant.isAddressConfidential) return { applies: false, reason: "Turn on confidential address to include this document." };
  return { applies: true, reason: "Included with the current fake intake settings." };
}

function inferPlaceholderSource(key: string) {
  if (/violence|affidavit|heading|blurb|intro|orders_sought/i.test(key)) return "Workflow";
  if (/date|month|year|age|name_upper|court_location/i.test(key)) return "Derived";
  if (/applicant/i.test(key)) return "Intake -> Applicant";
  if (/respondent/i.test(key)) return "Intake -> Respondent";
  if (/child/i.test(key)) return "Intake -> Children";
  return "Intake / generated field";
}

function fieldValue(matter: MatterFile, key: string) {
  const lower = key.toLowerCase();
  const selection = getMatterApplicationSelection(matter);
  if (lower === "applications") return selection.applications || "(blank)";
  if (lower === "relevant_legislation") return selection.relevantLegislation || "(blank)";
  if (lower.includes("applicant") && lower.includes("name")) return matter.intake.applicant.fullName;
  if (lower.includes("respondent") && lower.includes("name")) return matter.intake.respondent.fullName;
  if (lower.includes("court")) return matter.intake.courtLocation;
  if (lower.includes("fam")) return matter.intake.famNumber;
  if (lower.includes("legal_aid")) return matter.legalAidNumber || "(blank)";
  if (lower.includes("child_1")) return matter.intake.children[0]?.fullName ?? "(blank)";
  if (lower.includes("violence")) return matter.intake.familyViolenceTypes.join("; ") || "(blank)";
  return "auto / blank";
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TemplateStudioClient({
  template,
  previewText,
  placeholders,
  manifest: initialManifest,
  initialReason,
}: Props) {
  const [matter, setMatter] = useState<MatterFile>(() => cloneDemoMatter());
  const [manifest, setManifest] = useState<TemplateManifest>(initialManifest);
  const [activeTab, setActiveTab] = useState<Tab>("document");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const placeholderMap = useMemo(() => new Map(placeholders.map((placeholder) => [placeholder.raw, placeholder])), [placeholders]);
  const applicability = useMemo(() => appliesToMatter(template, matter), [template, matter]);
  const versions = manifest.status === "loaded" ? manifest.versions : [];
  const activeVersionId = manifest.status === "loaded" ? manifest.template.activeVersionId : "";
  const activeVersion = versions.find((version) => version.id === activeVersionId) ?? versions.find((version) => version.status === "active") ?? null;
  const draftVersion = versions.find((version) => version.status === "draft") ?? null;
  const testVersionId = selectedVersionId || draftVersion?.id || activeVersion?.id || "";
  const visiblePlaceholders = draftVersion?.scanResult?.placeholders ?? placeholders;
  const warningCount = visiblePlaceholders.filter((placeholder) => placeholder.status !== "known").length;

  const downloadTemplate = (versionId = "") => {
    const params = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
    window.location.href = `/api/templates/studio/${template.studioId}/download${params}`;
  };

  const uploadTemplate = async (file: File | null) => {
    if (!file) return;
    setIsBusy(true);
    setStatus("Uploading and scanning draft version...");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/templates/studio/${template.studioId}`, { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      setStatus(payload.error ?? "Upload failed.");
      setIsBusy(false);
      return;
    }
    setManifest(payload as TemplateManifest);
    setSelectedVersionId((payload as TemplateManifest).status === "loaded"
      ? ((payload as Extract<TemplateManifest, { status: "loaded" }>).versions.find((version) => version.status === "draft")?.id ?? "")
      : "");
    setStatus(payload.status === "loaded" ? "Draft version uploaded. Generate a test document before publishing." : payload.message);
    setIsBusy(false);
  };

  const testTemplate = async (versionId = testVersionId) => {
    setIsBusy(true);
    setStatus("Generating test document...");
    const response = await fetch(`/api/templates/studio/${template.studioId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matter, versionId: versionId || undefined }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unable to test this template." }));
      setStatus(payload.error ?? "Unable to test this template.");
      setIsBusy(false);
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
    setStatus("Downloaded actual generated DOCX for inspection.");
    setIsBusy(false);
  };

  const publishVersion = async (versionId: string) => {
    setIsBusy(true);
    setStatus("Publishing template version...");
    const response = await fetch(`/api/templates/studio/${template.studioId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      setStatus(payload.error ?? "Publish failed.");
      setIsBusy(false);
      return;
    }
    setManifest(payload as TemplateManifest);
    setSelectedVersionId("");
    setStatus("Version is now active for real matter generation.");
    setIsBusy(false);
  };

  const updateApplicationSelection = (noticeType: NoticeType, ordersSought: OrdersSought) => {
    setMatter((current) => ({
      ...current,
      intake: {
        ...current.intake,
        noticeType,
        ordersSought,
        proceedingsType: proceedingsTypeFromOrders(ordersSought),
        selectedApplications: selectedApplicationsFromStructured({
          noticeType,
          ordersSought,
          existingSelectedApplications: current.intake.selectedApplications,
        }),
      },
    }));
  };

  const setNoticeType = (noticeType: NoticeType) => {
    updateApplicationSelection(noticeType, deriveOrdersSought(matter.intake));
  };

  const toggleOrderSought = (order: keyof OrdersSought) => {
    const ordersSought = deriveOrdersSought(matter.intake);
    updateApplicationSelection(deriveNoticeType(matter.intake) || "without_notice", {
      ...ordersSought,
      [order]: !ordersSought[order],
    });
  };

  const toggleApplication = (application: ApplicationType) => {
    setMatter((current) => ({
      ...current,
      intake: {
        ...current.intake,
        selectedApplications: current.intake.selectedApplications.includes(application)
          ? current.intake.selectedApplications.filter((item) => item !== application)
          : [...current.intake.selectedApplications, application],
      },
    }));
  };

  const toggleViolence = (violenceType: FamilyViolenceType) => {
    setMatter((current) => ({
      ...current,
      intake: {
        ...current.intake,
        familyViolenceTypes: current.intake.familyViolenceTypes.includes(violenceType)
          ? current.intake.familyViolenceTypes.filter((item) => item !== violenceType)
          : [...current.intake.familyViolenceTypes, violenceType],
      },
    }));
  };

  const noticeType = deriveNoticeType(matter.intake);
  const ordersSought = deriveOrdersSought(matter.intake);
  const additionalApplicationTypes = applicationTypes.filter((application) =>
    !/^(Without Notice|On Notice) Application for (Protection|Parenting|Tenancy|Ancillary Furniture) Order$/.test(application),
  );

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
      return { ...current, intake: { ...current.intake, children: children.slice(0, count) } };
    });
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/settings/templates" className="text-sm font-semibold text-sky-700 transition hover:text-sky-900">Back to templates</Link>
        <header className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Template Studio</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">{template.title}</h1>
              <p className="mt-2 text-sm text-slate-600">{template.sourceFileName}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge label={activeVersion ? `Active v${activeVersion.versionNumber}` : "Repository active"} className="bg-emerald-100 text-emerald-900" />
                {draftVersion ? <Badge label={`Draft v${draftVersion.versionNumber}`} className="bg-amber-100 text-amber-900" /> : null}
                <Badge label={`${warningCount} warnings`} className={warningCount ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadTemplate()} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Download template</button>
              <label className="cursor-pointer rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800">
                Upload new version
                <input type="file" accept=".docx" className="sr-only" onChange={(event) => void uploadTemplate(event.target.files?.[0] ?? null)} />
              </label>
              <button type="button" disabled={isBusy || template.kind !== "docx" || !applicability.applies} onClick={() => void testTemplate()} className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Generate test</button>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">{status || applicability.reason || initialReason}</p>
          {manifest.status !== "loaded" ? <p className="mt-2 text-sm text-amber-700">{manifest.message}</p> : null}
        </header>

        <nav className="mt-5 flex flex-wrap gap-2 border-b border-slate-200">
          {([
            ["document", "Document"],
            ["fields", "Fields"],
            ["test-data", "Test Data"],
            ["versions", "Versions"],
          ] as Array<[Tab, string]>).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${activeTab === id ? "border-sky-600 text-sky-800" : "border-transparent text-slate-600"}`}>
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "document" ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
            <Panel title="Current Workflow">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Action label="1. Download" detail="Edit in Microsoft Word." />
                <Action label="2. Upload" detail="Creates a draft version." />
                <Action label="3. Test" detail="Downloads actual generated DOCX." />
                <Action label="4. Publish" detail="Makes draft active." />
              </div>
              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-950">Selected test version</h3>
                <select value={testVersionId} onChange={(event) => setSelectedVersionId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Repository fallback / active managed version</option>
                  {versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} - {version.status}</option>)}
                </select>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => downloadTemplate(testVersionId)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Download selected</button>
                  <button type="button" onClick={() => void testTemplate(testVersionId)} disabled={!applicability.applies || isBusy} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Generate selected test</button>
                  {draftVersion ? <button type="button" onClick={() => void publishVersion(draftVersion.id)} disabled={isBusy} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Publish draft v{draftVersion.versionNumber}</button> : null}
                </div>
              </div>
            </Panel>
            <Panel title="Draft Validation">
              {draftVersion?.scanResult ? <ScanSummary version={draftVersion} /> : <p className="text-sm leading-6 text-slate-600">Upload a DOCX to create a draft version. Real matters continue using the current active template until you publish.</p>}
            </Panel>
          </section>
        ) : null}

        {activeTab === "fields" ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <Panel title="Field Map">
              <div className="space-y-3">
                {visiblePlaceholders.map((placeholder) => (
                  <div key={placeholder.raw} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void navigator.clipboard?.writeText(placeholder.raw)} className={`rounded border px-2 py-1 font-mono text-xs ${placeholderClass(placeholder.status)}`}>{placeholder.raw}</button>
                      <Badge label={placeholder.status} className={statusClass(placeholder.status)} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Source: {inferPlaceholderSource(placeholder.canonicalKey ?? placeholder.key)}</p>
                    <p className="mt-1 text-xs text-slate-600">Test value: {fieldValue(matter, placeholder.canonicalKey ?? placeholder.key)}</p>
                    {placeholder.canonicalKey ? <p className="mt-1 text-xs text-slate-600">Suggested: {`{{${placeholder.canonicalKey}}}`}</p> : null}
                    {placeholder.issue ? <p className="mt-1 text-xs text-slate-600">{placeholder.issue}</p> : null}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Raw Template Text">
              <div className="max-h-[700px] overflow-auto rounded-md border border-slate-200 bg-slate-950 p-4 text-sm leading-7 text-slate-100">
                {template.kind === "docx" ? <PreviewText text={previewText} placeholderMap={placeholderMap} /> : <p>PDF field map is planned for Phase 3.</p>}
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "test-data" ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="Matter">
              <TextInput label="Applicant" value={matter.intake.applicant.fullName} onChange={(value) => setMatter((current) => ({ ...current, clientName: value, intake: { ...current.intake, applicant: { ...current.intake.applicant, fullName: value } } }))} />
              <TextInput label="Respondent" value={matter.intake.respondent.fullName} onChange={(value) => setMatter((current) => ({ ...current, intake: { ...current.intake, respondent: { ...current.intake.respondent, fullName: value } } }))} />
              <Select label="Court" value={matter.intake.courtLocation} options={courts} onChange={(value) => setMatter((current) => ({ ...current, intake: { ...current.intake, courtLocation: value as MatterFile["intake"]["courtLocation"] } }))} />
              <TextInput label="FAM number" value={matter.intake.famNumber} onChange={(value) => setMatter((current) => ({ ...current, intake: { ...current.intake, famNumber: value } }))} />
            </Panel>
            <Panel title="Applications">
              <Select label="Notice Type" value={noticeType} options={noticeTypes} optionLabels={noticeTypeLabels} onChange={(value) => setNoticeType(value as NoticeType)} />
              {orderOptions.map((order) => <CheckRow key={order.key} label={order.label} checked={ordersSought[order.key]} onChange={() => toggleOrderSought(order.key)} />)}
              {additionalApplicationTypes.map((application) => <CheckRow key={application} label={application} checked={matter.intake.selectedApplications.includes(application)} onChange={() => toggleApplication(application)} />)}
              <CheckRow label="Confidential address" checked={Boolean(matter.intake.applicant.isAddressConfidential)} onChange={() => setMatter((current) => ({ ...current, intake: { ...current.intake, applicant: { ...current.intake.applicant, isAddressConfidential: !current.intake.applicant.isAddressConfidential } } }))} />
              <CheckRow label="Fee waiver required" checked={matter.intake.feeWaiverRequired} onChange={() => setMatter((current) => ({ ...current, intake: { ...current.intake, feeWaiverRequired: !current.intake.feeWaiverRequired } }))} />
            </Panel>
            <Panel title="Family Violence">
              {familyViolenceTypes.map((violenceType) => <CheckRow key={violenceType} label={violenceType} checked={matter.intake.familyViolenceTypes.includes(violenceType)} onChange={() => toggleViolence(violenceType)} />)}
            </Panel>
            <Panel title="Children">
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 4].map((count) => <button key={count} type="button" onClick={() => setChildCount(count)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${matter.intake.children.length === count ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}>{count}</button>)}
              </div>
            </Panel>
          </section>
        ) : null}

        {activeTab === "versions" ? (
          <section className="mt-5">
            <Panel title="Version History">
              {versions.length === 0 ? <p className="text-sm text-slate-600">No managed versions yet. Repository template is currently active.</p> : (
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div key={version.id} className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-950">v{version.versionNumber}</p>
                          <Badge label={version.status} className={statusClass(version.status)} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{version.originalFileName} - {formatDate(version.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => downloadTemplate(version.id)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">Download</button>
                        <button type="button" onClick={() => void testTemplate(version.id)} className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">Test</button>
                        {version.status !== "active" ? <button type="button" onClick={() => void publishVersion(version.id)} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Activate / Restore</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </section>
        ) : null}
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
        return <span key={`${part}-${index}`} className={`rounded border px-1 py-0.5 ${placeholderClass(placeholder.status)}`}>{part}</span>;
      })}
    </pre>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function Action({ label, detail }: { label: string; detail: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-950">{label}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>;
}

function ScanSummary({ version }: { version: TemplateVersionRecord }) {
  const scan = version.scanResult;
  if (!scan) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Metric label="Recognised" value={scan.knownPlaceholders.length} />
      <Metric label="Unknown" value={scan.unknownPlaceholders.length} />
      <Metric label="Legacy" value={scan.legacyPlaceholders.length} />
      <Metric label="Malformed" value={scan.malformedPlaceholders.length} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>;
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-900">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" /></label>;
}

function Select({
  label,
  value,
  options,
  optionLabels = {},
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabels?: Partial<Record<string, string>>;
  onChange: (value: string) => void;
}) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-900">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}</select></label>;
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-slate-300" /><span>{label}</span></label>;
}
