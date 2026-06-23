"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  buildLegalAidReview,
  legalAidMatterStorageKey,
  getLegalAidStatus,
  legalAidTemplatePath,
  parentingOrderStandardWording,
  protectionOrderStandardWording,
  recentMattersStorageKey,
  confidentialLawyerPostalAddress,
  type LegalAidRecord,
  type LegalAidReview,
} from "../../lib/legal-aid";
import { courts, createEmptyMatter, type MatterFile } from "../../lib/matter";
import { demoLegalAidApplications, demoMatter, isDemoEnvironment } from "../../lib/demo-data";

type ReviewField = keyof LegalAidReview;

function updateReviewField(
  review: LegalAidReview,
  field: ReviewField,
  value: string,
): LegalAidReview {
  return { ...review, [field]: value };
}

function readRecentMatters(): MatterFile[] {
  try {
    const raw = window.localStorage.getItem(recentMattersStorageKey);
    return raw ? (JSON.parse(raw) as MatterFile[]) : [];
  } catch {
    window.localStorage.removeItem(recentMattersStorageKey);
    return [];
  }
}

function isWithinLastWeek(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
}

export default function LegalAidPage() {
  const [matter, setMatter] = useState<MatterFile | null>(null);
  const [review, setReview] = useState<LegalAidReview | null>(null);
  const [incomeProof, setIncomeProof] = useState<File | null>(null);
  const [signedPage, setSignedPage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [includeProtectionOrder, setIncludeProtectionOrder] = useState(false);
  const [includeParentingOrder, setIncludeParentingOrder] = useState(false);
  const [otherProceedings, setOtherProceedings] = useState("");
  const [recentMatters, setRecentMatters] = useState<MatterFile[]>([]);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [application, setApplication] = useState<LegalAidRecord | null>(null);
  const [savedApplications, setSavedApplications] = useState<LegalAidRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const storedRecent = readRecentMatters().filter((item) => (item.legalAidRequired ?? true) && isWithinLastWeek(item.updatedAt || item.createdAt));
    const recent = storedRecent.length ? storedRecent : isDemoEnvironment ? [demoMatter] : [];
    setRecentMatters(recent);
    void loadSavedApplications();
    const storedMatter = window.localStorage.getItem(legalAidMatterStorageKey);

    try {
      const parsedMatter = storedMatter
        ? JSON.parse(storedMatter) as MatterFile
        : recent[0] ?? null;
      if (parsedMatter) void loadMatter(parsedMatter);
    } catch {
      window.localStorage.removeItem(legalAidMatterStorageKey);
    }
  }, []);

  async function loadSavedApplications() {
    try {
      const response = await fetch("/api/legal-aid-applications", { cache: "no-store" });
      const payload = await response.json();
      if (payload.status === "loaded") {
        setSavedApplications(payload.data.length ? payload.data : isDemoEnvironment ? demoLegalAidApplications : []);
      }
    } catch {
      setSavedApplications(isDemoEnvironment ? demoLegalAidApplications : []);
    }
  }

  function applyApplicationRecord(record: LegalAidRecord, nextMatter: MatterFile | null = matter) {
    setApplication(record);
    setReview(record.review);
    setMatter(nextMatter);
    setSelectedMatterId(record.matterId);
    setIncludeProtectionOrder(Boolean(record.review.protectionOrderWording));
    setIncludeParentingOrder(Boolean(record.review.parentingOrderWording));
    setOtherProceedings(
      record.review.proceedingsType
        .replace(/^Without notice\s*/i, "")
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && part !== "Protection Order" && part !== "Parenting Order")
        .join(", "),
    );
    setIncomeProof(null);
    setSignedPage(null);
    setIsGenerated(record.status === "generated" || record.status === "submitted");
  }

  async function saveDraft(nextReview = review, currentApplication = application) {
    if (!nextReview) return null;

    setIsSaving(true);
    setNotice("");

    try {
      if (isDemoEnvironment) {
        const saved: LegalAidRecord = currentApplication
          ? {
              ...currentApplication,
              clientName: nextReview.clientName,
              review: nextReview,
              status: currentApplication.status,
              updatedAt: new Date().toISOString(),
            }
          : {
              id: `legal-aid-${nextReview.matterId || "demo"}`,
              matterId: nextReview.matterId || matter?.id || demoMatter.id,
              clientName: nextReview.clientName,
              status: getLegalAidStatus(true, true),
              hasIncomeProof: true,
              hasSignedPage: true,
              incomeProofPath: "demo/income-proof-example.pdf",
              signedPagePath: "demo/signed-page-5-example.pdf",
              incomeProofFileName: "income-proof-example.pdf",
              signedPageFileName: "signed-page-5-example.pdf",
              templatePath: legalAidTemplatePath,
              review: nextReview,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
        setApplication(saved);
        setSavedApplications((current) => {
          const withoutSaved = current.filter((item) => item.id !== saved.id);
          return [saved, ...withoutSaved];
        });
        setNotice("Legal Aid draft saved.");
        return saved;
      }

      const response = await fetch("/api/legal-aid-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: currentApplication
            ? {
                ...currentApplication,
                clientName: nextReview.clientName,
                review: nextReview,
                status: currentApplication.status,
              }
            : undefined,
          review: currentApplication ? undefined : nextReview,
        }),
      });
      const payload = await response.json();

      if (payload.status === "not_configured") {
        setNotice(`Supabase is not configured yet: ${payload.missing.join(", ")}.`);
        return null;
      }

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Unable to save Legal Aid application.");
      }

      const saved = payload.data as LegalAidRecord;
      setApplication(saved);
      setSavedApplications((current) => {
        const withoutSaved = current.filter((item) => item.id !== saved.id);
        return [saved, ...withoutSaved];
      });
      setNotice("Legal Aid draft saved.");
      return saved;
    } catch (caughtError) {
      setNotice(caughtError instanceof Error ? caughtError.message : "Unable to save Legal Aid application.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function loadMatter(nextMatter: MatterFile) {
    const nextReview = buildLegalAidReview(nextMatter);
    const reviewWithConfidentialAddress = nextMatter.intake.applicant.isAddressConfidential
      ? {
          ...nextReview,
          homeAddress: "Confidential Address",
          lawyerPostalAddress: confidentialLawyerPostalAddress,
        }
      : nextReview;
    const existingApplication = savedApplications.find((item) => item.matterId === nextMatter.id);
    const hasProtectionOrder = nextMatter.intake.selectedApplications.some((application) =>
      application.toLowerCase().includes("protection order"),
    );
    const hasParentingOrder = nextMatter.intake.selectedApplications.some((application) =>
      application.toLowerCase().includes("parenting order"),
    );

    setMatter(nextMatter);
    setSelectedMatterId(nextMatter.id);
    setReview(existingApplication?.review ?? reviewWithConfidentialAddress);
    setApplication(existingApplication ?? null);
    setIncludeProtectionOrder(hasProtectionOrder);
    setIncludeParentingOrder(hasParentingOrder);
    setOtherProceedings(
      nextMatter.intake.selectedApplications.includes("Other")
        ? nextMatter.intake.otherApplicationDetails
        : "",
    );
    window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(nextMatter));
    await saveDraft(existingApplication?.review ?? reviewWithConfidentialAddress, existingApplication ?? null);
  }

  function createManualMatter() {
    const nextMatter = createEmptyMatter();
    void loadMatter(nextMatter);
  }

  function buildProceedingsType({
    protectionOrder,
    parentingOrder,
    other,
  }: {
    protectionOrder: boolean;
    parentingOrder: boolean;
    other: string;
  }) {
    const proceedings = [
      protectionOrder ? "Protection Order" : "",
      parentingOrder ? "Parenting Order" : "",
      other.trim(),
    ].filter(Boolean);

    return proceedings.length ? `Without notice ${proceedings.join(", ")}` : "";
  }

  function updateProceedings({
    protectionOrder = includeProtectionOrder,
    parentingOrder = includeParentingOrder,
    other = otherProceedings,
  }: {
    protectionOrder?: boolean;
    parentingOrder?: boolean;
    other?: string;
  }) {
    setIncludeProtectionOrder(protectionOrder);
    setIncludeParentingOrder(parentingOrder);
    setOtherProceedings(other);
    setReview((current) => {
      if (!current) return current;
      const nextReview = {
        ...current,
          proceedingsType: buildProceedingsType({ protectionOrder, parentingOrder, other }),
          protectionOrderWording: protectionOrder ? current.protectionOrderWording || protectionOrderStandardWording : "",
          parentingOrderWording: parentingOrder ? current.parentingOrderWording || parentingOrderStandardWording : "",
          abuseSummary: protectionOrder ? current.abuseSummary : "",
      };
      void saveDraft(nextReview, application);
      return nextReview;
    });
  }

  const status = useMemo(
    () => application?.status === "submitted"
      ? "submitted"
      : isGenerated
      ? "generated"
      : getLegalAidStatus(Boolean(incomeProof || application?.hasIncomeProof), Boolean(signedPage || application?.hasSignedPage)),
    [application, incomeProof, signedPage, isGenerated],
  );

  async function markSubmitted() {
    if (!application) return;
    const saved = await saveDraft(review, { ...application, status: "submitted" });
    if (saved) setNotice("Legal Aid application marked as submitted.");
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
    kind: "incomeProof" | "signedPage",
  ) {
    const file = event.target.files?.[0] ?? null;
    setter(file);
    setIsGenerated(false);

    if (!file || !review) return;

    const saved = await saveDraft(review);
    if (!saved) return;

    setIsSaving(true);
    setNotice("");

    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

      const response = await fetch(`/api/legal-aid-applications/${encodeURIComponent(saved.id)}/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (payload.status === "not_configured") {
        setNotice(`Supabase is not configured yet: ${payload.missing.join(", ")}.`);
        return;
      }

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Unable to save Legal Aid upload.");
      }

      const nextApplication = payload.data as LegalAidRecord;
      setApplication(nextApplication);
      setSavedApplications((current) => {
        const withoutSaved = current.filter((item) => item.id !== nextApplication.id);
        return [nextApplication, ...withoutSaved];
      });
      setNotice(kind === "incomeProof" ? "Income proof saved. Signed page 5 can be uploaded later." : "Signed page 5 saved. Income proof can be uploaded later.");
    } catch (caughtError) {
      setNotice(caughtError instanceof Error ? caughtError.message : "Unable to save Legal Aid upload.");
    } finally {
      setIsSaving(false);
    }
  }

  async function generateLegalAidApplication() {
    if (!review) {
      setError("Load or save a matter before generating the Legal Aid application.");
      return;
    }

    const saved = await saveDraft(review);

    if (saved?.hasIncomeProof && saved.hasSignedPage) {
      setIsGenerating(true);
      setError("");

      try {
        const formData = new FormData();
        formData.append("applicationId", saved.id);

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
        await loadSavedApplications();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to generate Legal Aid application.");
      } finally {
        setIsGenerating(false);
      }
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

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Missing income proof", savedApplications.filter((item) => !item.hasIncomeProof).length],
            ["Missing signed page 5", savedApplications.filter((item) => item.hasIncomeProof && !item.hasSignedPage).length],
            ["Ready", savedApplications.filter((item) => item.status === "ready_to_generate").length],
            ["Generated", savedApplications.filter((item) => item.status === "generated").length],
            ["Submitted", savedApplications.filter((item) => item.status === "submitted").length],
          ].map(([label, count]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-form"><p className="text-2xl font-semibold text-slate-950">{count}</p><p className="mt-1 text-xs font-medium text-slate-600">{label}</p></div>)}
        </section>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-form">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Client lookup</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Select a client created in the last 7 days, or create a blank Legal Aid application if the intake is not available.
              </p>
            </div>
            <button
              type="button"
              onClick={createManualMatter}
              className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Create blank application
            </button>
          </div>
          <div className="mt-4">
              <SelectField
                label="Recent client"
                value={selectedMatterId}
                onChange={(value) => {
                  const selected = recentMatters.find((item) => item.id === value);
                if (selected) void loadMatter(selected);
              }}
              options={recentMatters.map((item) => ({
                label: item.intake.applicant.fullName || item.clientName || item.id,
                value: item.id,
              }))}
              placeholder="Select recent client"
            />
          </div>
          {savedApplications.length ? (
            <div className="mt-4">
              <SelectField
                label="Saved Legal Aid application"
                value={application?.id ?? ""}
                onChange={(value) => {
                  const selected = savedApplications.find((item) => item.id === value);
                  if (selected) applyApplicationRecord(selected);
                }}
                options={savedApplications.map((item) => ({
                  label: `${item.clientName || item.review.clientName} - ${item.status.replace(/_/g, " ")}`,
                  value: item.id,
                }))}
                placeholder="Reopen saved application"
              />
            </div>
          ) : null}
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
              <ProceedingsSetupSection
                review={review}
                includeProtectionOrder={includeProtectionOrder}
                includeParentingOrder={includeParentingOrder}
                otherProceedings={otherProceedings}
                onProtectionChange={(checked) => updateProceedings({ protectionOrder: checked })}
                onParentingChange={(checked) => updateProceedings({ parentingOrder: checked })}
                onOtherProceedingsChange={(value) => updateProceedings({ other: value })}
                onCourtChange={(value) => setReview((current) => {
                  if (!current) return current;
                  const nextReview = updateReviewField(current, "courtLocation", value);
                  void saveDraft(nextReview, application);
                  return nextReview;
                })}
              />
              <ReviewSection
                review={review}
                matter={matter}
                onChange={(field, value) => setReview((current) => current ? updateReviewField(current, field, value) : current)}
                onSave={() => void saveDraft(review)}
                isSaving={isSaving}
              />
              <WordingSection
                review={review}
                onChange={(field, value) => setReview((current) => current ? updateReviewField(current, field, value) : current)}
              />
              {notice ? <p className="text-sm font-medium text-sky-800">{notice}</p> : null}
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
                    savedFileName={application?.incomeProofFileName ?? ""}
                    isSaved={Boolean(application?.hasIncomeProof)}
                    onChange={(event) => void handleFileChange(event, setIncomeProof, "incomeProof")}
                  />
                  <UploadField
                    label="Signed client page 5"
                    detail="Replaces page 5."
                    file={signedPage}
                    savedFileName={application?.signedPageFileName ?? ""}
                    isSaved={Boolean(application?.hasSignedPage)}
                    onChange={(event) => void handleFileChange(event, setSignedPage, "signedPage")}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <h2 className="text-lg font-semibold text-slate-950">Next action</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {status === "submitted" ? "This application is recorded as submitted." : status === "generated" ? "The PDF is generated. Mark it submitted once it has been sent to Legal Aid." : status === "ready_to_generate" ? "Both required uploads are present. Generate the completed PDF." : "Complete the missing upload shown above."}
                </p>
                {status !== "submitted" ? <button
                  type="button"
                  disabled={isGenerating || status === "generated" || !(incomeProof || application?.hasIncomeProof) || !(signedPage || application?.hasSignedPage)}
                  className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={generateLegalAidApplication}
                >
                  {isGenerating ? "Generating..." : "Generate Legal Aid PDF"}
                </button> : null}
                {status === "generated" ? <button type="button" onClick={() => void markSubmitted()} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Mark as submitted</button> : null}
                <p className="mt-3 text-xs text-slate-500">Source template: {legalAidTemplatePath}</p>
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
  onSave,
  isSaving,
}: {
  review: LegalAidReview;
  matter: MatterFile | null;
  onChange: (field: ReviewField, value: string) => void;
  onSave: () => void;
  isSaving: boolean;
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
        <Field label="Proceedings type" value={review.proceedingsType} onChange={(value) => onChange("proceedingsType", value)} className="md:col-span-2" />
        <TextArea label="Home address" value={review.homeAddress} onChange={(value) => onChange("homeAddress", value)} rows={3} />
        <TextArea label="Lawyer postal address" value={review.lawyerPostalAddress} onChange={(value) => onChange("lawyerPostalAddress", value)} rows={3} />
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        {isSaving ? "Saving..." : "Save Legal Aid draft"}
      </button>
    </section>
  );
}

function ProceedingsSetupSection({
  review,
  includeProtectionOrder,
  includeParentingOrder,
  otherProceedings,
  onProtectionChange,
  onParentingChange,
  onOtherProceedingsChange,
  onCourtChange,
}: {
  review: LegalAidReview;
  includeProtectionOrder: boolean;
  includeParentingOrder: boolean;
  otherProceedings: string;
  onProtectionChange: (checked: boolean) => void;
  onParentingChange: (checked: boolean) => void;
  onOtherProceedingsChange: (value: string) => void;
  onCourtChange: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <h2 className="text-lg font-semibold text-slate-950">Application setup</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Select the without-notice proceedings and court before reviewing the wording.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={includeProtectionOrder}
            onChange={(event) => onProtectionChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Protection Order
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            checked={includeParentingOrder}
            onChange={(event) => onParentingChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Parenting Order
        </label>
        <SelectField
          label="Court"
          value={review.courtLocation}
          onChange={onCourtChange}
          options={courts}
          placeholder="Select court"
        />
        <Field
          label="Other proceedings"
          value={otherProceedings}
          onChange={onOtherProceedingsChange}
          className="md:col-span-2"
        />
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

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | { label: string; value: string })[];
  placeholder: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          return (
          <option key={value} value={value}>
            {label}
          </option>
          );
        })}
      </select>
    </label>
  );
}

function UploadField({
  label,
  detail,
  file,
  savedFileName,
  isSaved,
  onChange,
}: {
  label: string;
  detail: string;
  file: File | null;
  savedFileName: string;
  isSaved: boolean;
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
      {isSaved ? (
        <span className="mt-2 block text-xs font-medium text-emerald-700">
          Saved{savedFileName ? `: ${savedFileName}` : ""}
        </span>
      ) : (
        <span className="mt-2 block text-xs font-medium text-amber-700">Pending</span>
      )}
    </label>
  );
}
