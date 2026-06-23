"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  applicationTypes,
  courts,
  createEmptyChild,
  createEmptyMatter,
  ethnicities,
  normalizeProceedingsType,
  proceedingsTypeLabels,
  proceedingsTypes,
  type ApplicationType,
  type Child,
  type MatterFile,
  type Party,
} from "../lib/matter";
import { calculateChildDisplayAge } from "../lib/document-automation";
import { legalAidMatterStorageKey, recentMattersStorageKey } from "../lib/legal-aid";
import {
  billingClientsStorageKey,
  createBillingClientId,
  normalizeClientName,
  type BillingClientProfile,
} from "../lib/billing-storage";
import { demoMatter, isDemoEnvironment } from "../lib/demo-data";

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
  optionLabels = {},
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
  optionLabels?: Record<string, string>;
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
            {optionLabels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
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

function readBillingClients(): BillingClientProfile[] {
  try {
    const raw = window.localStorage.getItem(billingClientsStorageKey);
    return raw ? (JSON.parse(raw) as BillingClientProfile[]) : [];
  } catch {
    window.localStorage.removeItem(billingClientsStorageKey);
    return [];
  }
}

export default function IntakeForm() {
  const searchParams = useSearchParams();
  const [matter, setMatter] = useState<MatterFile>(() => isDemoEnvironment ? structuredClone(demoMatter) : createEmptyMatter());
  const [saveStatus, setSaveStatus] = useState("");

  const setMatterValue = (field: "clientName" | "legalAidNumber" | "legalAidRequired", value: string | boolean) => {
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

  const setProceedingsType = (value: MatterFile["intake"]["proceedingsType"]) => {
    const proceedingsType = normalizeProceedingsType(value);
    const selectedApplications: ApplicationType[] =
      proceedingsType === "both"
        ? [
            "Without Notice Application for Protection Order",
            "Without Notice Application for Parenting Order",
          ]
        : proceedingsType === "protection_order"
          ? ["Without Notice Application for Protection Order"]
          : proceedingsType === "care_of_children"
            ? ["Without Notice Application for Parenting Order"]
            : [];

    setMatter((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      intake: {
        ...current.intake,
        proceedingsType,
        selectedApplications,
      },
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

  const toggleApplication = (application: ApplicationType) => {
    const selected = matter.intake.selectedApplications.includes(application)
      ? matter.intake.selectedApplications.filter((item) => item !== application)
      : [...matter.intake.selectedApplications, application];

    setIntakeValue("selectedApplications", selected);
  };

  const addChild = () => {
    setMatter((current) => {
      return {
        ...current,
        updatedAt: new Date().toISOString(),
        intake: {
          ...current.intake,
          children: [
            ...current.intake.children,
            {
              ...createEmptyChild(current.id, current.intake.children.length + 1),
              livingWithName: current.intake.applicant.fullName || "Applicant",
            },
          ],
        },
      };
    });
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
            nextChild.age = calculateChildDisplayAge(value);
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

  function inferApplicationType(): BillingClientProfile["applicationType"] {
    const proceedingsType = normalizeProceedingsType(matter.intake.proceedingsType);
    if (proceedingsType === "both") return "both";
    if (proceedingsType === "care_of_children") return "parenting";
    if (proceedingsType === "protection_order") return "protection";

    const selectedApplications = matter.intake.selectedApplications.join(" ").toLowerCase();
    const hasParenting = selectedApplications.includes("parenting");
    const hasProtection = selectedApplications.includes("protection");

    if (hasParenting && hasProtection) return "both";
    if (hasParenting) return "parenting";
    if (hasProtection) return "protection";
    return "";
  }

  const saveDraft = async (options: { quiet?: boolean } = {}): Promise<BillingClientProfile | null> => {
    if (!options.quiet) setSaveStatus("");
    window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(matter));
    const existing = readRecentMatters();
    window.localStorage.setItem(
      recentMattersStorageKey,
      JSON.stringify([matter, ...existing.filter((item) => item.id !== matter.id)].slice(0, 25)),
    );
    window.dispatchEvent(new CustomEvent("newgen:matter-saved"));

    const clientName = normalizeClientName(matter.intake.applicant.fullName || matter.clientName);
    if (!clientName) {
      if (!options.quiet) setSaveStatus("Add the client or applicant name before saving.");
      return null;
    }

    if (clientName) {
      const now = new Date().toISOString();
      const clients = readBillingClients();
      const existingClient = clients.find((client) =>
        client.clientName.toLowerCase() === clientName.toLowerCase(),
      );
      const profile: BillingClientProfile = existingClient
        ? {
            ...existingClient,
            clientName,
            legalAidNumber: matter.legalAidNumber,
            famNumber: matter.intake.famNumber,
            clientEmail: matter.intake.applicant.emailAddress,
            applicationType: existingClient.applicationType || inferApplicationType(),
            updatedAt: now,
          }
        : {
            id: createBillingClientId(`${clientName}-${matter.id}`),
            clientName,
            legalAidNumber: matter.legalAidNumber,
            famNumber: matter.intake.famNumber,
            clientEmail: matter.intake.applicant.emailAddress,
            applicationType: inferApplicationType(),
            createdAt: now,
            updatedAt: now,
          };
      const nextClients = existingClient
        ? clients.map((client) => (client.id === existingClient.id ? profile : client))
        : [profile, ...clients];

      window.localStorage.setItem(
        billingClientsStorageKey,
        JSON.stringify(nextClients),
      );

      try {
        await fetch("/api/matters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matter, clientId: profile.id }),
        }).catch(() => undefined);

        await fetch("/api/billing-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });

        if (!options.quiet) setSaveStatus("Matter saved. Choose a storage action separately when the documents are ready.");
        return profile;
      } catch (error) {
        if (!options.quiet) {
          setSaveStatus(error instanceof Error ? error.message : "Intake saved locally, but remote setup failed.");
        }
        if (options.quiet) throw error;
        return profile;
      }
    }

    return null;
  };

  useEffect(() => {
    window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(matter));
  }, [matter]);

  useEffect(() => {
    const matterId = searchParams.get("matterId");
    if (!matterId) return;

    const localMatter = readRecentMatters().find((item) => item.id === matterId);
    if (localMatter) {
      setMatter(localMatter);
      window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(localMatter));
      return;
    }

    void fetch("/api/matters", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; data?: MatterFile[] } | null) => {
        const remoteMatter = payload?.status === "loaded" ? payload.data?.find((item) => item.id === matterId) : null;
        if (remoteMatter) {
          setMatter(remoteMatter);
          window.localStorage.setItem(legalAidMatterStorageKey, JSON.stringify(remoteMatter));
        }
      })
      .catch(() => undefined);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">New Matter</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">Matter intake</h1>
        </div>
        <button
          type="button"
          onClick={() => void saveDraft()}
          className="h-10 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
        >
          Save intake
        </button>
      </header>
      {saveStatus ? <p className="text-sm font-medium text-slate-700">{saveStatus}</p> : null}

      <Card title="Matter overview">
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Matter client"
            value={matter.clientName}
            onChange={(value) => setMatterValue("clientName", value)}
            placeholder="Primary client name"
          />
          <Field
            label="Legal Aid Number"
            value={matter.legalAidNumber}
            onChange={(value) => setMatterValue("legalAidNumber", value)}
          />
          <label className="flex min-h-10 items-center gap-3 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950">
            <input
              type="checkbox"
              checked={matter.legalAidRequired ?? true}
              onChange={(event) => setMatterValue("legalAidRequired", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Legal Aid Application Required</span>
          </label>
          <Field
            label="Applicant MSD Client Number"
            value={matter.intake.msdClientNumber ?? ""}
            onChange={(value) => setIntakeValue("msdClientNumber", value)}
            placeholder="MSD client number"
          />
        </div>
      </Card>

      <Card title="Applications Being Filed">
        <div className="mb-5 grid gap-5 md:grid-cols-2">
          <SelectField
            label="Proceedings Type"
            value={normalizeProceedingsType(matter.intake.proceedingsType) ?? ""}
            onChange={(value) => setProceedingsType(value as MatterFile["intake"]["proceedingsType"])}
            placeholder="Select proceedings type"
            options={proceedingsTypes}
            optionLabels={proceedingsTypeLabels}
          />
        </div>
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
        {matter.intake.selectedApplications.includes("Other") ? (
          <TextArea
            label="Other application"
            value={matter.intake.otherApplicationDetails ?? ""}
            onChange={(value) => setIntakeValue("otherApplicationDetails", value)}
            rows={3}
            className="mt-4"
            placeholder="Type the application being filed."
          />
        ) : null}
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
        </div>
      </Card>

      <Card title="Applicant Details">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full Name" value={matter.intake.applicant.fullName} onChange={(value) => setPartyValue("applicant", "fullName", value)} required />
          <Field label="Date of Birth" type="date" value={matter.intake.applicant.dateOfBirth} onChange={(value) => setPartyValue("applicant", "dateOfBirth", value)} />
          <SelectField label="Gender" value={matter.intake.applicant.gender ?? ""} onChange={(value) => setPartyValue("applicant", "gender", value)} placeholder="Select" options={["F", "M"]} />
          <Field label="Occupation" value={matter.intake.applicant.occupation} onChange={(value) => setPartyValue("applicant", "occupation", value)} />
          <Field label="Mobile Phone" value={matter.intake.applicant.mobilePhone} onChange={(value) => setPartyValue("applicant", "mobilePhone", value)} placeholder="021 xxx xxxx" />
          <Field label="Email Address" value={matter.intake.applicant.emailAddress} onChange={(value) => setPartyValue("applicant", "emailAddress", value)} className="md:col-span-2" />
          <TextArea label="Home Address" value={matter.intake.applicant.homeAddress} onChange={(value) => setPartyValue("applicant", "homeAddress", value)} rows={3} className="md:col-span-2" />
          <SelectField label="Ethnic Origin" value={matter.intake.applicant.ethnicity} onChange={(value) => setPartyValue("applicant", "ethnicity", value)} placeholder="Select ethnicity" options={ethnicities} />
          {matter.intake.applicant.ethnicity === "Other" ? (
            <Field label="Other Ethnic Origin" value={matter.intake.applicant.otherEthnicity ?? ""} onChange={(value) => setPartyValue("applicant", "otherEthnicity", value)} />
          ) : null}
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
          <SelectField label="Gender" value={matter.intake.respondent.gender ?? ""} onChange={(value) => setPartyValue("respondent", "gender", value)} placeholder="Select" options={["F", "M"]} />
          <Field label="Occupation" value={matter.intake.respondent.occupation} onChange={(value) => setPartyValue("respondent", "occupation", value)} />
          <Field label="Mobile Phone" value={matter.intake.respondent.mobilePhone} onChange={(value) => setPartyValue("respondent", "mobilePhone", value)} placeholder="021 xxx xxxx" />
          <Field label="Email Address" value={matter.intake.respondent.emailAddress} onChange={(value) => setPartyValue("respondent", "emailAddress", value)} />
          <TextArea label="Home Address" value={matter.intake.respondent.homeAddress} onChange={(value) => setPartyValue("respondent", "homeAddress", value)} rows={3} />
          <TextArea label="Work Address" value={matter.intake.respondent.workAddress} onChange={(value) => setPartyValue("respondent", "workAddress", value)} rows={3} />
          <SelectField label="Ethnic Origin" value={matter.intake.respondent.ethnicity} onChange={(value) => setPartyValue("respondent", "ethnicity", value)} placeholder="Select ethnicity" options={ethnicities} />
          {matter.intake.respondent.ethnicity === "Other" ? (
            <Field label="Other Ethnic Origin" value={matter.intake.respondent.otherEthnicity ?? ""} onChange={(value) => setPartyValue("respondent", "otherEthnicity", value)} />
          ) : null}
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

      <Card title="Children Affected by the Application" description="Add every child included in the application. Additional children are carried into a continuation section where a fixed court template has limited space.">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={addChild}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-slate-50"
          >
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
                  {child.ethnicity === "Other" ? (
                    <Field label="Other Ethnic Origin" value={child.otherEthnicity ?? ""} onChange={(value) => updateChild(child.id, "otherEthnicity", value)} />
                  ) : null}
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

    </div>
  );
}
