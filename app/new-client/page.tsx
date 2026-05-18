import Link from "next/link";
import IntakeForm from "../../components/IntakeForm";

export default function NewClientPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm font-medium text-sky-700 transition hover:text-sky-900"
          >
            Back to dashboard
          </Link>
        </div>
        <IntakeForm />
      </div>
    </main>
  );
}
