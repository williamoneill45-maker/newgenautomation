import Link from "next/link";

const notifications = [
  {
    title: "Legal aid billing",
    detail: "Billing workbench is ready for prompt-to-draft testing with controlled wording and travel references.",
    status: "New",
  },
  {
    title: "Template placeholders",
    detail: "Information Sheet placeholders will become the shared dictionary.",
    status: "Setup",
  },
  {
    title: "Document queue",
    detail: "All Family Court forms are marked as required for each matter.",
    status: "Ready",
  },
];

const workItems = [
  "Matter intake",
  "DOCX placeholder merge",
  "Legal aid billing",
  "Domestic violence affidavit draft",
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
              Family Law Automation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              Dashboard
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/billing"
              className="inline-flex h-10 items-center justify-center rounded-md border border-sky-200 bg-white px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              Billing workbench
            </Link>
            <Link
              href="/new-client"
              className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              New client
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {workItems.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-form"
            >
              <p className="text-sm font-medium text-slate-600">Workflow</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{item}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-950">Recent Matters</h2>
              <span className="text-sm text-slate-500">0 open</span>
            </div>
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No matters yet.
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
            <h2 className="text-lg font-semibold text-slate-950">Notifications</h2>
            <div className="mt-5 space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.title}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">
                      {notification.title}
                    </h3>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {notification.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-600">
                    {notification.detail}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
