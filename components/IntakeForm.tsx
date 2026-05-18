"use client";

import { useEffect, useState } from "react";
import {
  applicationTypes,
  courts,
  createEmptyChild,
  createEmptyMatter,
  ethnicities,
  type ApplicationType,
  type Child,
  type MatterFile,
  type Party,
} from "../lib/matter";
import { calculateAge } from "../lib/document-automation";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
};

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  className = "",
}: FieldProps) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-950">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function IntakeForm() {
  const [matter, setMatter] = useState<MatterFile>(() => createEmptyMatter());
  const [affidavitDraft, setAffidavitDraft] = useState("");
  const [isDraftingAffidavit, setIsDraftingAffidavit] = useState(false);
  const [affidavitDraftError, setAffidavitDraftError] = useState("");

  const setMatterValue = (field: "legalAidNumber" | "clientName", value: string) => {
    setMatter((current) => ({ ...current, [field]: value, updatedAt: new Date().toISOString() }));
  };

  const setIntakeValue = <T extends keyof MatterFile["intake"]>(
    field: T,
    value: MatterFile["intake"][T],
  ) => {
    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: { ...current.intake, [field]: value },
    }));
  };

  const setPartyValue = (
    role: "applicant" | "respondent",
    field: keyof Party,
    value: string | boolean,
  ) => {
    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: {
        ...current.intake,
        [role]: { ...current.intake[role], [field]: value },
      },
    }));
  };

  useEffect(() => {
    const historyNotes = matter.intake.domesticViolenceNotes.history.trim();
    const recentEventsNotes = matter.intake.domesticViolenceNotes.recentEvents.trim();

    if (!historyNotes && !recentEventsNotes) {
      setAffidavitDraft("");
      setAffidavitDraftError("");
      setIsDraftingAffidavit(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsDraftingAffidavit(true);
      setAffidavitDraftError("");

      try {
        const response = await fetch("/api/draft-affidavit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicantName: matter.intake.applicant.fullName,
            respondentName: matter.intake.respondent.fullName,
            historyNotes,
            recentEventsNotes,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Drafting request failed");
        }

        const data = (await response.json()) as { draft?: string };
        setAffidavitDraft(data.draft ?? "");
      } catch (error) {
        if (!controller.signal.aborted) {
          setAffidavitDraftError("Draft could not be updated.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsDraftingAffidavit(false);
        }
      }
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    matter.intake.applicant.fullName,
    matter.intake.respondent.fullName,
    matter.intake.domesticViolenceNotes.history,
    matter.intake.domesticViolenceNotes.recentEvents,
  ]);

  const toggleApplication = (application: ApplicationType) => {
    const selected = matter.intake.selectedApplications.includes(application)
      ? matter.intake.selectedApplications.filter((item) => item !== application)
      : [...matter.intake.selectedApplications, application];

    setIntakeValue("selectedApplications", selected);
  };

  const addChild = () => {
    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: {
        ...current.intake,
        children: [
          ...current.intake.children,
          createEmptyChild(current.id, current.intake.children.length + 1),
        ],
      },
    }));
  };

  const updateChild = (childId: string, field: keyof Child, value: string) => {
    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: {
        ...current.intake,
        children: current.intake.children.map((child) => {
          if (child.id !== childId) {
            return child;
          }

          const nextChild = { ...child, [field]: value };
          if (field === "dateOfBirth") {
            nextChild.age = calculateAge(value);
          }

          return nextChild;
        }),
      },
    }));
  };

  const removeChild = (childId: string) => {
    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: {
        ...current.intake,
        children: current.intake.children.filter((child) => child.id !== childId),
      },
    }));
  };

  const saveDraft = () => {
    window.localStorage.setItem("newgenautomation:draftMatter", JSON.stringify(matter));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">New Client</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Matter Intake</h1>
        </div>
        <button
          type="button"
          onClick={saveDraft}
          className="h-10 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Save intake
        </button>
      </header>

      <Card title="Matter Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Legal Aid Number"
            value={matter.legalAidNumber}
            onChange={(value) => setMatterValue("legalAidNumber", value)}
            placeholder="Add later when issued"
          />
          <Field
            label="Client Name"
            value={matter.clientName}
            onChange={(value) => setMatterValue("clientName", value)}
            placeholder="Primary client name"
          />
        </div>
      </Card>

      <Card title="Applications Being Filed">
        <div className="grid gap-3 md:grid-cols-2">
          {applicationTypes.map((application) => (
            <label key={application} className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950">
              <input
                type="checkbox"
                checked={matter.intake.selectedApplications.includes(application)}
                onChange={() => toggleApplication(application)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>{application}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Court Filing Details">
        <div className="grid gap-5 md:grid-cols-2">
          <SelectField
            label="Court Location"
            value={matter.intake.courtLocation}
            onChange={(value) => setIntakeValue("courtLocation", value as MatterFile["intake"]["courtLocation"])}
            placeholder="Select court"
            options={courts}
          />
          <Field label="FAM Number" value={matter.intake.famNumber} onChange={(value) => setIntakeValue("famNumber", value)} placeholder="FAM-" />
        </div>
      </Card>

      <Card title="Applicant Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full Name" value={matter.intake.applicant.fullName} onChange={(value) => setPartyValue("applicant", "fullName", value)} required />
          <Field label="Date of Birth" type="date" value={matter.intake.applicant.dateOfBirth} onChange={(value) => setPartyValue("applicant", "dateOfBirth", value)} />
          <Field label="Occupation" value={matter.intake.applicant.occupation} onChange={(value) => setPartyValue("applicant", "occupation", value)} />
          <Field label="Mobile Phone" value={matter.intake.applicant.mobilePhone} onChange={(value) => setPartyValue("applicant", "mobilePhone", value)} placeholder="021 xxx xxxx" />
          <Field label="Email Address" value={matter.intake.applicant.emailAddress} onChange={(value) => setPartyValue("applicant", "emailAddress", value)} className="md:col-span-2" />
          <TextArea label="Home Address" value={matter.intake.applicant.homeAddress} onChange={(value) => setPartyValue("applicant", "homeAddress", value)} rows={3} className="md:col-span-2" />
          <SelectField label="Ethnic Origin" value={matter.intake.applicant.ethnicity} onChange={(value) => setPartyValue("applicant", "ethnicity", value)} placeholder="Select ethnicity" options={ethnicities} />
          <label className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950">
            <input
              type="checkbox"
              checked={Boolean(matter.intake.applicant.isAddressConfidential)}
              onChange={(event) => setPartyValue("applicant", "isAddressConfidential", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Confidential Address</span>
          </label>
        </div>
      </Card>

      <Card title="Respondent Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full Name" value={matter.intake.respondent.fullName} onChange={(value) => setPartyValue("respondent", "fullName", value)} />
          <Field label="Relationship to Applicant" value={matter.intake.respondent.relationshipToApplicant ?? ""} onChange={(value) => setPartyValue("respondent", "relationshipToApplicant", value)} placeholder="e.g. Spouse, partner, ex-partner" />
          <Field label="Date of Birth" type="date" value={matter.intake.respondent.dateOfBirth} onChange={(value) => setPartyValue("respondent", "dateOfBirth", value)} />
          <Field label="Occupation" value={matter.intake.respondent.occupation} onChange={(value) => setPartyValue("respondent", "occupation", value)} />
          <TextArea label="Home Address" value={matter.intake.respondent.homeAddress} onChange={(value) => setPartyValue("respondent", "homeAddress", value)} rows={3} />
          <TextArea label="Work Address" value={matter.intake.respondent.workAddress} onChange={(value) => setPartyValue("respondent", "workAddress", value)} rows={3} />
          <SelectField label="Ethnic Origin" value={matter.intake.respondent.ethnicity} onChange={(value) => setPartyValue("respondent", "ethnicity", value)} placeholder="Select ethnicity" options={ethnicities} />
        </div>
      </Card>

      <Card title="Relationship Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Date of Marriage / Civil Union" value={matter.intake.relationship.marriageOrCivilUnionDate} onChange={(value) => setIntakeValue("relationship", { ...matter.intake.relationship, marriageOrCivilUnionDate: value })} placeholder="DD/MM/YYYY or N/A" />
          <Field label="Place of Marriage / Civil Union" value={matter.intake.relationship.marriageOrCivilUnionPlace} onChange={(value) => setIntakeValue("relationship", { ...matter.intake.relationship, marriageOrCivilUnionPlace: value })} />
          <Field label="De Facto Relationship Start" value={matter.intake.relationship.deFactoRelationshipStart} onChange={(value) => setIntakeValue("relationship", { ...matter.intake.relationship, deFactoRelationshipStart: value })} />
          <Field label="Relationship End Date" value={matter.intake.relationship.relationshipEndDate} onChange={(value) => setIntakeValue("relationship", { ...matter.intake.relationship, relationshipEndDate: value })} />
        </div>
      </Card>

      <Card title="Children Affected by the Application">
        <div className="mb-5 flex justify-end">
          <button type="button" onClick={addChild} className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-slate-50">
            + Add Child
          </button>
        </div>
        {matter.intake.children.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-500">No children added.</div>
        ) : (
          <div className="space-y-4">
            {matter.intake.children.map((child, index) => (
              <div key={child.id} className="rounded-md border border-slate-200 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-950">Child {index + 1}</h3>
                  <button type="button" onClick={() => removeChild(child.id)} className="h-8 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">Remove</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Full Name" value={child.fullName} onChange={(value) => updateChild(child.id, "fullName", value)} className="lg:col-span-2" />
                  <Field label="Date of Birth" type="date" value={child.dateOfBirth} onChange={(value) => updateChild(child.id, "dateOfBirth", value)} />
                  <Field label="Age" value={child.age} onChange={(value) => updateChild(child.id, "age", value)} />
                  <SelectField label="Gender" value={child.gender} onChange={(value) => updateChild(child.id, "gender", value)} placeholder="Select" options={["F", "M"]} />
                  <SelectField label="Ethnic Origin" value={child.ethnicity} onChange={(value) => updateChild(child.id, "ethnicity", value)} placeholder="Select ethnicity" options={ethnicities} />
                  <Field label="Applicant Relationship" value={child.applicantRelationshipToChild} onChange={(value) => updateChild(child.id, "applicantRelationshipToChild", value)} />
                  <Field label="Respondent Relationship" value={child.respondentRelationshipToChild} onChange={(value) => updateChild(child.id, "respondentRelationshipToChild", value)} />
                  <Field label="Living With" value={child.livingWithName} onChange={(value) => updateChild(child.id, "livingWithName", value)} className="md:col-span-1 lg:col-span-2" />
                  <Field label="Living With Relationship to Child" value={child.livingWithRelationshipToChild} onChange={(value) => updateChild(child.id, "livingWithRelationshipToChild", value)} className="md:col-span-1 lg:col-span-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Previous Applications and Existing Orders">
        <div className="grid gap-4 md:grid-cols-3">
          <TextArea label="Previous Applications" value={matter.intake.proceedings.previousApplications} onChange={(value) => setIntakeValue("proceedings", { ...matter.intake.proceedings, previousApplications: value })} rows={2} />
          <TextArea label="Orders Between Parties" value={matter.intake.proceedings.existingOrdersBetweenParties} onChange={(value) => setIntakeValue("proceedings", { ...matter.intake.proceedings, existingOrdersBetweenParties: value })} rows={2} />
          <TextArea label="Orders Relating to Children" value={matter.intake.proceedings.existingOrdersRelatingToChildren} onChange={(value) => setIntakeValue("proceedings", { ...matter.intake.proceedings, existingOrdersRelatingToChildren: value })} rows={2} />
        </div>
      </Card>

      <Card title="Domestic Violence Affidavit">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <TextArea label="History Notes" value={matter.intake.domesticViolenceNotes.history} onChange={(value) => setIntakeValue("domesticViolenceNotes", { ...matter.intake.domesticViolenceNotes, history: value })} rows={10} placeholder="Type the history as the lawyer works through the intake." />
            <TextArea label="Recent Events Notes" value={matter.intake.domesticViolenceNotes.recentEvents} onChange={(value) => setIntakeValue("domesticViolenceNotes", { ...matter.intake.domesticViolenceNotes, recentEvents: value })} rows={10} placeholder="Type the events leading to this application." />
          </div>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-slate-950">
              <span>Affidavit Draft</span>
              {isDraftingAffidavit ? <span className="text-xs font-medium text-sky-700">Drafting...</span> : null}
            </span>
            <textarea value={affidavitDraft} readOnly rows={22} className="w-full resize-y rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm outline-none" />
            {affidavitDraftError ? <span className="mt-2 block text-xs text-red-600">{affidavitDraftError}</span> : null}
          </label>
        </div>
      </Card>
    </div>
  );
}
