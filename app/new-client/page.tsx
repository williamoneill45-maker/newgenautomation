import Link from "next/link";
import DocumentDownloadPanel from "../../components/DocumentDownloadPanel";
import IntakeForm from "../../components/IntakeForm";

export default function NewClientPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
          >
            Back to dashboard
          </Link>
        </div>
        <DocumentDownloadPanel />
        <IntakeForm />
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Optional Legal Aid</h2>
              <p className="mt-1 text-sm text-slate-600">
                Start this after induction documents are signed and the MSD response is available.
              </p>
            </div>
            <Link
              href="/legal-aid"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Open Legal Aid
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
