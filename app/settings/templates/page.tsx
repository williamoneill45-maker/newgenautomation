import path from "node:path";

import Link from "next/link";

import { requiredDocumentDefinitions } from "../../../lib/document-catalog";
import { documentWorkflows } from "../../../lib/document-workflows";
import { scanTemplateFile } from "../../../lib/template-scanner";
import { standardDocxTemplates, confidentialAddressInformationSheet } from "../../../lib/template-catalog";
import { TemplateUploadScanner } from "./_components/TemplateUploadScanner";

function getTemplateStatus(report: Awaited<ReturnType<typeof scanTemplateFile>>) {
  if (!report.exists) return "Missing";
  if (!report.canScan) return report.fileType === "doc" ? "Convert DOC" : "Static";
  if (report.malformedPlaceholders.length > 0) return "Blocked";
  if (report.unknownPlaceholders.length > 0) return "Unknown fields";
  if (report.legacyPlaceholders.length > 0) return "Legacy aliases";
  return "Clean";
}

function statusClass(status: string) {
  if (status === "Clean") return "bg-emerald-100 text-emerald-900";
  if (status === "Static") return "bg-slate-100 text-slate-700";
  if (status === "Legacy aliases") return "bg-sky-100 text-sky-900";
  if (status === "Missing" || status === "Blocked") return "bg-rose-100 text-rose-900";
  return "bg-amber-100 text-amber-900";
}

export default async function TemplatesPage() {
  const templateRoot = path.join(process.cwd(), "templates");
  const configuredTemplates = [
    ...standardDocxTemplates,
    {
      id: "static_pdf",
      title: confidentialAddressInformationSheet.title,
      sourceFileName: confidentialAddressInformationSheet.sourceFileName,
      outputFileName: confidentialAddressInformationSheet.outputFileName,
    },
  ];
  const rows = await Promise.all(
    configuredTemplates.map(async (template) => {
      const report = await scanTemplateFile(path.join(templateRoot, template.sourceFileName));
      return {
        template,
        report,
        status: getTemplateStatus(report),
      };
    }),
  );

  const cleanCount = rows.filter((row) => row.status === "Clean").length;
  const blockedCount = rows.filter((row) => row.status === "Blocked" || row.status === "Missing").length;
  const reviewCount = rows.length - cleanCount - blockedCount;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <Link href="/settings" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to settings
          </Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-sky-700">Template Studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Templates</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Scan configured templates, catch broken placeholders before generation, and make workflow logic visible.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Configured" value={String(rows.length)} detail="Templates in catalog" />
          <Metric label="Clean" value={String(cleanCount)} detail="No scanner blockers" />
          <Metric label="Needs review" value={String(reviewCount)} detail="Legacy, static, or old format" />
          <Metric label="Blocked" value={String(blockedCount)} detail="Missing or malformed" />
        </section>

        <TemplateUploadScanner />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Template Audit</h2>
              <p className="mt-1 text-sm text-slate-600">Only DOCX files can be scanned. Legacy DOC files should be converted to DOCX.</p>
            </div>
            <Link href="/settings/template-fields" className="text-sm font-semibold text-sky-700 transition hover:text-sky-900">
              View field dictionary
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {rows.map((row) => (
              <article key={`${row.template.sourceFileName}-${row.template.outputFileName}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{row.template.title}</h3>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{row.template.sourceFileName}</p>
                    <p className="mt-1 text-xs text-slate-500">Output: {row.template.outputFileName}</p>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-4 lg:min-w-[420px]">
                    <Count label="Known" value={row.report.knownPlaceholders.length} />
                    <Count label="Legacy" value={row.report.legacyPlaceholders.length} />
                    <Count label="Unknown" value={row.report.unknownPlaceholders.length} />
                    <Count label="Malformed" value={row.report.malformedPlaceholders.length} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <IssueList title="Legacy aliases" placeholders={row.report.legacyPlaceholders} />
                  <IssueList title="Unknown fields" placeholders={row.report.unknownPlaceholders} />
                  <IssueList title="Malformed fields" placeholders={row.report.malformedPlaceholders} />
                </div>

                <div className="mt-4 rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended action</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {row.report.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Workflow Rules</h2>
          <p className="mt-1 text-sm text-slate-600">Document packs should be explicit so conditional logic can be checked before generation.</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {documentWorkflows.map((workflow) => (
              <article key={workflow.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">{workflow.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{workflow.description}</p>
                <div className="mt-4 space-y-3">
                  {workflow.items.map((item) => (
                    <div key={`${workflow.id}-${item.outputPrefix}-${item.title}`} className="border-t border-slate-100 pt-3">
                      <p className="text-sm font-semibold text-slate-900">{item.outputPrefix} {item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.includeWhen}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.requiredFields.slice(0, 5).map((field) => (
                          <code key={field} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                            {field}
                          </code>
                        ))}
                        {item.requiredFields.length > 5 ? (
                          <span className="text-xs text-slate-500">+{item.requiredFields.length - 5}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function IssueList({
  title,
  placeholders,
}: {
  title: string;
  placeholders: Array<{ raw: string; canonicalKey?: string; issue?: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {placeholders.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {placeholders.map((placeholder) => (
            <li key={`${placeholder.raw}-${placeholder.canonicalKey ?? ""}`} className="rounded-md bg-slate-50 p-2 text-sm">
              <code className="text-slate-900">{placeholder.raw}</code>
              {placeholder.canonicalKey ? (
                <p className="mt-1 text-xs text-slate-600">Use {`{{${placeholder.canonicalKey}}}`}</p>
              ) : null}
              {placeholder.issue ? <p className="mt-1 text-xs text-slate-600">{placeholder.issue}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
