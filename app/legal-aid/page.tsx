"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  buildLegalAidReview,
  getLegalAidStatus,
  legalAidMatterStorageKey,
  legalAidTemplatePath,
  type LegalAidReview,
} from "../../lib/legal-aid";
import type { MatterFile } from "../../lib/matter";

type ReviewField = keyof LegalAidReview;

function updateReviewField(
  review: LegalAidReview,
  field: ReviewField,
  value: string,
): LegalAidReview {
  return { ...review, [field]: value };
}

export default function LegalAidPage() {
  const [matter, setMatter] = useState<MatterFile | null>(null);
  const [review, setReview] = useState<LegalAidReview | null>(null);
  const [incomeProof, setIncomeProof] = useState<File | null>(null);
  const [signedPage, setSignedPage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  useEffect(() => {
    const storedMatter = window.localStorage.getItem(legalAidMatterStorageKey);
    if (!storedMatter) return;

    try {
      const parsedMatter = JSON.parse(storedMatter) as MatterFile;
      setMatter(parsedMatter);
      setReview(buildLegalAidReview(parsedMatter));
    } catch {
      window.localStorage.removeItem(legalAidMatterStorageKey);
    }
  }, []);

  const status = useMemo(
    () => isGenerated ? "generated" : getLegalAidStatus(Boolean(incomeProof), Boolean(signedPage)),
    [incomeProof, signedPage, isGenerated],
  );

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
  ) {
    setter(event.target.files?.[0] ?? null);
    setIsGenerated(false);
  }

  async function generateLegalAidApplication() {
    if (!review) {
      setError("Load or save a matter before generating the Legal Aid application.");
      return;
    }

    if (!incomeProof) {
      setError("Income proof screenshot or scan is required.");
      return;
    }

    if (!signedPage) {
      setError("Signed client page 5 screenshot or scan is required.");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("review", JSON.stringify(review));
      formData.append("incomeProof", incomeProof);
      formData.append("signedPage", signedPage);

      const response = await fetch("/api/generate-legal-aid", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to generate Legal Aid application.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName = fileNameMatch?.[1] ?? "Legal Aid Application.pdf";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setIsGenerated(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to generate Legal Aid application.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-700 transition hover:text-sky-900">
            Back to dashboard
          </Link>
          <span className="rounded-md bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
            Separate from initial document ZIP
          </span>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal aid</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Legal Aid Application</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Review matter details, attach income proof and the signed client page, then generate the completed PDF.
          </p>
        </header>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <h2 className="text-base font-semibold text-slate-950">Future client lookup</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            For now this uses the saved intake. Later it will let the lawyer select from clients created in the last 7 days or search manually to pull client details into the Legal Aid application.
          </p>
        </section>

        {!review ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-form">
            <h2 className="text-lg font-semibold text-slate-950">No saved matter found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Save the client intake first. The Legal Aid application will then pull the client and matter details from that saved matter.
            </p>
            <Link
              href="/new-client"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              Go to intake
            </Link>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <ReviewSection
                review={review}
                matter={matter}
                onChange={(field, value) => setReview((current) => current ? updateReviewField(current, field, value) : current)}
              />
              <WordingSection
                review={review}
                onChange={(field, value) => setReview((current) => current ? updateReviewField(current, field, value) : current)}
              />
            </div>

            <aside className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">Required uploads</h2>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  <UploadField
                    label="Income proof"
                    detail="Inserted after page 2."
                    file={incomeProof}
                    onChange={(event) => handleFileChange(event, setIncomeProof)}
                  />
                  <UploadField
                    label="Signed client page 5"
                    detail="Replaces page 5."
                    file={signedPage}
                    onChange={(event) => handleFileChange(event, setSignedPage)}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <h2 className="text-lg font-semibold text-slate-950">Generate PDF</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Source template: {legalAidTemplatePath}
                </p>
                <button
                  type="button"
                  disabled={isGenerating || !incomeProof || !signedPage}
                  className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={generateLegalAidApplication}
                >
                  {isGenerating ? "Generating..." : "Generate Legal Aid PDF"}
                </button>
                {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
              </section>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}

function ReviewSection({
  review,
  matter,
  onChange,
}: {
  review: LegalAidReview;
  matter: MatterFile | null;
  onChange: (field: ReviewField, value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Matter details</h2>
          <p className="mt-1 text-sm text-slate-600">
            {matter?.id ?? review.matterId}
          </p>
        </div>
        <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
          Loaded from intake
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Client name" value={review.clientName} onChange={(value) => onChange("clientName", value)} />
        <Field label="Date of birth" value={review.dob} onChange={(value) => onChange("dob", value)} />
        <Field label="Mobile phone" value={review.mobilePhone} onChange={(value) => onChange("mobilePhone", value)} />
        <Field label="Email" value={review.email} onChange={(value) => onChange("email", value)} />
        <Field label="Number of children" value={review.numberOfChildren} onChange={(value) => onChange("numberOfChildren", value)} />
        <Field label="Court location" value={review.courtLocation} onChange={(value) => onChange("courtLocation", value)} />
        <Field label="Proceedings type" value={review.proceedingsType} onChange={(value) => onChange("proceedingsType", value)} className="md:col-span-2" />
        <TextArea label="Home address" value={review.homeAddress} onChange={(value) => onChange("homeAddress", value)} rows={3} />
        <TextArea label="Lawyer postal address" value={review.lawyerPostalAddress} onChange={(value) => onChange("lawyerPostalAddress", value)} rows={3} />
      </div>
    </section>
  );
}

function WordingSection({
  review,
  onChange,
}: {
  review: LegalAidReview;
  onChange: (field: ReviewField, value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <h2 className="text-lg font-semibold text-slate-950">Review wording</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        These sections are inserted into the Legal Aid application for lawyer review before filing.
      </p>
      <div className="mt-5 space-y-4">
        <TextArea
          label="Protection order wording"
          value={review.protectionOrderWording}
          onChange={(value) => onChange("protectionOrderWording", value)}
          rows={4}
        />
        <TextArea
          label="Abuse summary"
          value={review.abuseSummary}
          onChange={(value) => onChange("abuseSummary", value)}
          rows={4}
        />
        <TextArea
          label="Parenting order wording"
          value={review.parentingOrderWording}
          onChange={(value) => onChange("parentingOrderWording", value)}
          rows={4}
        />
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`} htmlFor={id}>
      {label}
      <input
        id={id}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <textarea
        id={id}
        rows={rows}
        className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function UploadField({
  label,
  detail,
  file,
  onChange,
}: {
  label: string;
  detail: string;
  file: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block rounded-md border border-slate-200 p-3" htmlFor={id}>
      <span className="block text-sm font-semibold text-slate-950">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100"
        onChange={onChange}
      />
      {file ? <span className="mt-2 block text-xs font-medium text-emerald-700">{file.name}</span> : null}
    </label>
  );
}
