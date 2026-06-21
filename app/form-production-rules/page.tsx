import { access } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";

import { requiredDocumentDefinitions } from "../../lib/document-catalog";
import { standardDocxTemplates } from "../../lib/template-catalog";

function getTemplateForDocument(documentId: string) {
  return standardDocxTemplates.find((template) => template.id === documentId);
}

async function templateExists(sourceFileName: string) {
  if (!sourceFileName.endsWith(".docx")) return true;

  try {
    await access(path.join(process.cwd(), "templates", sourceFileName));
    return true;
  } catch {
    return false;
  }
}

function getRuleStatus({
  hasTemplate,
  hasRequiredPlaceholders,
}: {
  hasTemplate: boolean;
  hasRequiredPlaceholders: boolean;
}) {
  if (!hasTemplate) return "Missing template";
  if (!hasRequiredPlaceholders) return "Needs placeholder review";
  return "Active";
}

function getFixText(status: string, sourceFileName: string) {
  if (status === "Missing template") {
    return `Upload ${sourceFileName} to /templates, then redeploy.`;
  }

  if (status === "Needs placeholder review") {
    return "Confirm the template contains the required placeholders shown here.";
  }

  return "No blocker. Test with a saved intake and confirm the ZIP output.";
}

export default async function FormProductionRulesPage() {
  const rows = await Promise.all(
    requiredDocumentDefinitions
      .filter((document) => document.id !== "legal_aid_application")
      .map(async (document) => {
        const template = getTemplateForDocument(document.id) ?? {
          sourceFileName: "No template configured",
          outputFileName: "Not generated",
        };
        const hasTemplate = await templateExists(template.sourceFileName);
        const hasRequiredPlaceholders = document.requiredPlaceholders.length > 0;
        const status = getRuleStatus({ hasTemplate, hasRequiredPlaceholders });

        return {
          document,
          template,
          status,
          howToFix: getFixText(status, template.sourceFileName),
        };
      }),
  );

  const activeCount = rows.filter((row) => row.status === "Active").length;
  const missingCount = rows.filter((row) => row.status !== "Active").length;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Back to dashboard
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-sky-700">
              Form production management
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Form Production Rules
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Review what the new-client ZIP produces, which templates are used, what fields are required, and what must be fixed before relying on each document.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/new-client"
              className="inline-flex h-10 items-center justify-center rounded-md border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              Open new client
            </Link>
            <Link
              href="/billing-management/form-32b"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Billing rules
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <Metric label="ZIP output" value="Client_Forms.zip" detail="Named from client name" />
          <Metric label="Active rules" value={String(activeCount)} detail="Ready for testing" />
          <Metric label="Needs review" value={String(missingCount)} detail="Template or placeholder issue" />
          <Metric label="Legal Aid" value="Separate" detail="Not included in initial ZIP" />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <RuleNote
            label="Generation rule"
            value="The new-client ZIP uses deterministic DOCX placeholder replacement for standard forms. It does not recreate forms in HTML, JSX, or PDF."
          />
          <RuleNote
            label="Affidavit rule"
            value="Family violence affidavit evidence is drafted from intake notes and inserted as editable, automatically numbered text in the source DOCX when notes exist."
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <h2 className="text-lg font-semibold text-slate-950">Document rules</h2>
            <span className="text-sm text-slate-500">{rows.length} ZIP rules</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Document</th>
                  <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Source</th>
                  <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Output</th>
                  <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Required placeholders</th>
                  <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Status</th>
                  <th className="border-b border-slate-200 py-2 font-semibold">How to fix</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.document.id} className="align-top">
                    <td className="border-b border-slate-100 py-3 pr-4">
                      <p className="font-medium text-slate-950">{row.document.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.document.stages.join(" + ")}</p>
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{row.template.sourceFileName}</td>
                    <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{row.template.outputFileName}</td>
                    <td className="border-b border-slate-100 py-3 pr-4">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {row.document.requiredPlaceholders.map((placeholder) => (
                          <code key={placeholder} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                            {placeholder}
                          </code>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 py-3 pr-4">
                      <span
                        className={row.status === "Active"
                          ? "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900"
                          : "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900"}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 py-3 text-slate-700">{row.howToFix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-lg font-semibold text-slate-950">Temporary dashboard notification rules</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
            <p>If a required template is missing, the dashboard should flag it before document generation is relied on.</p>
            <p>If affidavit notes exist but AI drafting is unavailable, the validation report should identify fallback drafting.</p>
            <p>Legal Aid application remains separate because it requires later uploads and PDF assembly.</p>
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

function RuleNote({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
