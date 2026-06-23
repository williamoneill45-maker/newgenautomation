import Link from "next/link";

const tools = [
  { href: "/form-production-rules", title: "Form production rules", description: "Review document templates and placeholder rules." },
  { href: "/billing-management/form-32b", title: "Form32B billing rules", description: "Maintain Form32B fee and wording settings." },
  { href: "/billing-management/form-33a", title: "Form33A billing rules", description: "Maintain Form33A fee and wording settings." },
  { href: "/affidavit", title: "Affidavit drafting tool", description: "Open the standalone drafting utility." },
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Administrative tools and rule editors are kept here so the main navigation stays focused on daily legal work.</p>
        </header>
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-form transition hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <h2 className="font-semibold text-slate-950">{tool.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
