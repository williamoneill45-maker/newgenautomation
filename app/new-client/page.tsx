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
          <Link
            href="/legal-aid"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            Legal Aid application
          </Link>
        </div>
        <DocumentDownloadPanel />
        <IntakeForm />
      </div>
    </main>
  );
}
