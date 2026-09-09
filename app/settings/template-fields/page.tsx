import Link from "next/link";

import { getFieldsByCategory, legacyTemplateAliases } from "../../../lib/template-fields";

export default function TemplateFieldsPage() {
  const categories = getFieldsByCategory().filter(([, fields]) => fields.length > 0);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <Link href="/settings" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to settings
          </Link>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-sky-700">Template Studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Template Fields</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Canonical fields NewGen can send into DOCX templates. Templates should use lowercase snake_case fields, with bold and capitalisation controlled by the Word template or by derived uppercase field values.
          </p>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric label="Canonical fields" value={String(categories.reduce((sum, [, fields]) => sum + fields.length, 0))} detail="Approved for templates" />
          <Metric label="Legacy aliases" value={String(legacyTemplateAliases.length)} detail="Supported temporarily" />
          <Metric label="Naming rule" value="snake_case" detail="No spaces or capitals inside braces" />
        </section>

        <section className="mt-6 space-y-6">
          {categories.map(([category, fields]) => (
            <div key={category} className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <h2 className="text-lg font-semibold text-slate-950">{category}</h2>
                <span className="text-sm text-slate-500">{fields.length} fields</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Field</th>
                      <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Meaning</th>
                      <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Example</th>
                      <th className="border-b border-slate-200 py-2 pr-4 font-semibold">Source</th>
                      <th className="border-b border-slate-200 py-2 font-semibold">Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.key} className="align-top">
                        <td className="border-b border-slate-100 py-3 pr-4">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-800">
                            {`{{${field.key}}}`}
                          </code>
                          <p className="mt-1 text-xs text-slate-500">{field.label}</p>
                        </td>
                        <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{field.description}</td>
                        <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{field.example}</td>
                        <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">{field.source}</td>
                        <td className="border-b border-slate-100 py-3 text-slate-700">{field.format ?? "Plain text"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">Aliases To Retire</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            These aliases should keep working while older templates are cleaned up, but new templates should not use them.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-amber-800">
                  <th className="border-b border-amber-200 py-2 pr-4 font-semibold">Old field</th>
                  <th className="border-b border-amber-200 py-2 pr-4 font-semibold">Use instead</th>
                  <th className="border-b border-amber-200 py-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {legacyTemplateAliases.map((alias) => (
                  <tr key={alias.alias} className="align-top">
                    <td className="border-b border-amber-100 py-3 pr-4">
                      <code className="rounded bg-white px-1.5 py-0.5 text-xs text-amber-950">{`{{${alias.alias}}}`}</code>
                    </td>
                    <td className="border-b border-amber-100 py-3 pr-4">
                      <code className="rounded bg-white px-1.5 py-0.5 text-xs text-amber-950">{`{{${alias.canonical}}}`}</code>
                    </td>
                    <td className="border-b border-amber-100 py-3 text-amber-900">{alias.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
