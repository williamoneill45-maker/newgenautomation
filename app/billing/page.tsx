"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { travelReferences, type BillingFormType, type BillingRecord } from "../../lib/billing-automation";
import { calculateBillingTotals } from "../../lib/billing-document";
import {
  billingClientsStorageKey,
  billingInvoicesStorageKey,
  createBillingClientId,
  normalizeClientName,
  type BillingClientProfile,
  type BillingEvidenceFile,
  type StoredBillingInvoice,
} from "../../lib/billing-storage";
import {
  billingWorkItems,
  createStructuredBillingRecord,
  getBillingPreviewRows,
  validateStructuredBillingInput,
  type BillingItemDetails,
  type BillingWorkItemId,
  type StructuredBillingInput,
} from "../../lib/billing-selection";
import { demoMatter, isDemoEnvironment } from "../../lib/demo-data";
import { form32BSettingsStorageKey } from "../../lib/form32b-rules";
import { form33ASettingsStorageKey } from "../../lib/form33a-rules";
import { recentMattersStorageKey } from "../../lib/legal-aid";
import { createEmptyMatter, type CourtLocation, type MatterFile } from "../../lib/matter";

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
const emptyDetails: BillingItemDetails = { date: today, court: "", startTime: "", endTime: "" };

type EvidenceImage = {
  id: string;
  label: string;
  fileName: string;
  contentType: "image/png" | "image/jpeg";
  dataUrl: string;
};

type BillingSuggestion = {
  key: string;
  label: string;
  detail: string;
  clientName: string;
  legalAidNumber: string;
  famNumber: string;
  matter?: MatterFile;
  client?: BillingClientProfile;
};

function makeInvoiceNumber(formType: BillingFormType, clientName: string): string {
  const surname = clientName.trim().split(/\s+/).pop()?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "CLIENT";
  return `${today.replace(/-/g, "")}.${formType}.${surname}`;
}

function readLocal<T>(key: string): T[] {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

function writeRecentMatters(matters: MatterFile[]) {
  window.localStorage.setItem(recentMattersStorageKey, JSON.stringify(matters));
}

function writeBillingClients(clients: BillingClientProfile[]) {
  window.localStorage.setItem(billingClientsStorageKey, JSON.stringify(clients));
}

function matterLabel(matter?: MatterFile, fallbackClient = ""): string {
  if (!matter) return fallbackClient ? `${fallbackClient} billing matter` : "Billing matter";
  const proceeding = matter.intake.proceedingsType ? matter.intake.proceedingsType.replace(/_/g, " ") : "matter";
  return `${matter.clientName || fallbackClient || "Client"} â€“ ${proceeding}`;
}

function uniqueSuggestions(matters: MatterFile[], clients: BillingClientProfile[], search: string): BillingSuggestion[] {
  const normalized = search.trim().toLowerCase();
  const byKey = new Map<string, BillingSuggestion>();

  for (const matter of matters) {
    if (normalized && ![matter.clientName, matter.legalAidNumber, matter.intake.famNumber].join(" ").toLowerCase().includes(normalized)) continue;
    byKey.set(`matter:${matter.id}`, {
      key: `matter:${matter.id}`,
      label: matter.clientName || "Unnamed matter",
      detail: [matter.intake.famNumber, matter.legalAidNumber, matter.status.replace(/_/g, " ")].filter(Boolean).join(" Â· ") || "Matter profile",
      clientName: matter.clientName,
      legalAidNumber: matter.legalAidNumber,
      famNumber: matter.intake.famNumber,
      matter,
    });
  }

  for (const client of clients) {
    if (normalized && ![client.clientName, client.legalAidNumber, client.famNumber].join(" ").toLowerCase().includes(normalized)) continue;
    const matchingMatter = matters.find((matter) =>
      normalizeClientName(matter.clientName).toLowerCase() === normalizeClientName(client.clientName).toLowerCase() ||
      (!!client.famNumber && matter.intake.famNumber === client.famNumber) ||
      (!!client.legalAidNumber && matter.legalAidNumber === client.legalAidNumber)
    );
    const key = matchingMatter ? `matter:${matchingMatter.id}` : `client:${client.id}`;
    if (byKey.has(key)) {
      const existing = byKey.get(key);
      if (existing) byKey.set(key, { ...existing, client });
      continue;
    }
    byKey.set(key, {
      key,
      label: client.clientName || "Unnamed client",
      detail: [client.famNumber, client.legalAidNumber, "Billing profile"].filter(Boolean).join(" Â· "),
      clientName: client.clientName,
      legalAidNumber: client.legalAidNumber,
      famNumber: client.famNumber,
      matter: matchingMatter,
      client,
    });
  }

  return [...byKey.values()].slice(0, 8);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export default function BillingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">Loading billingâ€¦</main>}>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [formType, setFormType] = useState<BillingFormType>("32B");
  const [clientName, setClientName] = useState(isDemoEnvironment ? demoMatter.clientName : "");
  const [legalAidNumber, setLegalAidNumber] = useState(isDemoEnvironment ? demoMatter.legalAidNumber : "");
  const [famNumber, setFamNumber] = useState(isDemoEnvironment ? demoMatter.intake.famNumber : "");
  const [selectedMatterId, setSelectedMatterId] = useState(isDemoEnvironment ? demoMatter.id : "");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [createClaimRecord, setCreateClaimRecord] = useState(true);
  const [invoiceType, setInvoiceType] = useState<"interim" | "final">("interim");
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<BillingWorkItemId[]>(isDemoEnvironment ? ["32-pre-hearing-matters"] : []);
  const [detailsByItem, setDetailsByItem] = useState<Partial<Record<BillingWorkItemId, BillingItemDetails>>>({});
  const [agentHearingType, setAgentHearingType] = useState<StructuredBillingInput["agentHearingType"]>();
  const [additionalFactorSection, setAdditionalFactorSection] = useState<StructuredBillingInput["additionalFactorSection"]>();
  const [travelTimeSelected, setTravelTimeSelected] = useState(false);
  const [mileageSelected, setMileageSelected] = useState(false);
  const [travelCourt, setTravelCourt] = useState("");
  const [parking, setParking] = useState(0);
  const [officeDisbursements, setOfficeDisbursements] = useState(0);
  const [optionalWordingNotes, setOptionalWordingNotes] = useState("");
  const [wordingOverrides, setWordingOverrides] = useState<Partial<Record<BillingWorkItemId, string>>>({});
  const [editableWording, setEditableWording] = useState("");
  const [evidenceImages, setEvidenceImages] = useState<EvidenceImage[]>([]);
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingToOneDrive, setIsSavingToOneDrive] = useState(false);
  const [oneDriveConfigured, setOneDriveConfigured] = useState(false);
  const [generatedRecord, setGeneratedRecord] = useState<BillingRecord | null>(null);
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState("");
  const [matters, setMatters] = useState<MatterFile[]>([]);
  const [clients, setClients] = useState<BillingClientProfile[]>([]);

  const selectedMatter = useMemo(() => matters.find((matter) => matter.id === selectedMatterId), [matters, selectedMatterId]);
  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId), [clients, selectedClientId]);
  const matterName = matterLabel(selectedMatter, clientName);
  const formItems = billingWorkItems.filter((item) => item.formType === formType);
  const groupedItems = useMemo(() => formItems.reduce<Record<string, typeof formItems>>((groups, item) => {
    groups[item.group] = [...(groups[item.group] ?? []), item];
    return groups;
  }, {}), [formType]);
  const selectedTravelReference = travelReferences.find((reference) => reference.court === travelCourt);

  useEffect(() => {
    const localMatters = [demoMatter, ...readLocal<MatterFile>(recentMattersStorageKey)].filter((matter, index, all) => all.findIndex((item) => item.id === matter.id) === index);
    const localClients = readLocal<BillingClientProfile>(billingClientsStorageKey);
    setMatters(localMatters);
    setClients(localClients);

    const queryClient = searchParams.get("client")?.trim();
    if (queryClient) {
      const match = uniqueSuggestions(localMatters, localClients, queryClient)[0];
      if (match) selectSuggestion(match);
      else setClientName(queryClient);
    }

    void fetch("/api/matters")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.status === "loaded" && Array.isArray(payload.data)) {
          setMatters((current) => [...payload.data, ...current].filter((matter, index, all) => all.findIndex((item) => item.id === matter.id) === index));
        }
      })
      .catch(() => undefined);
    void fetch("/api/billing-clients")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.status === "loaded" && Array.isArray(payload.clients)) {
          setClients((current) => [...payload.clients, ...current].filter((client, index, all) => all.findIndex((item) => item.id === client.id) === index));
        }
      })
      .catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const overrides: Partial<Record<BillingWorkItemId, string>> = {};
    const storageKeys: Array<[BillingFormType, string]> = [
      ["32B", form32BSettingsStorageKey],
      ["33A", form33ASettingsStorageKey],
    ];

    storageKeys.forEach(([settingsFormType, storageKey]) => {
      const storedSettings = window.localStorage.getItem(storageKey);
      if (!storedSettings) return;
      try {
        const settings = JSON.parse(storedSettings) as { wordingByRuleId?: Record<string, string> };
        billingWorkItems
          .filter((item) => item.formType === settingsFormType)
          .forEach((item) => {
            const wording = settings.wordingByRuleId?.[item.managementRuleId];
            if (typeof wording === "string") overrides[item.id] = wording;
          });
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    });
    setWordingOverrides(overrides);
    void fetch("/api/onedrive-status")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setOneDriveConfigured(Boolean(payload?.configured)))
      .catch(() => setOneDriveConfigured(false));
  }, []);

  const suggestions = useMemo(() => uniqueSuggestions(matters, clients, clientName), [matters, clients, clientName]);
  const structuredInput: StructuredBillingInput = {
    formType,
    clientName,
    matterName,
    legalAidNumber,
    invoiceNumber: makeInvoiceNumber(formType, clientName),
    invoiceType,
    selectedWorkItemIds,
    detailsByItem,
    agentHearingType,
    additionalFactorSection,
    travelTimeSelected,
    mileageSelected,
    travelCourt,
    parking,
    officeDisbursements,
    optionalWordingNotes,
    wordingOverrides,
  };
  const validationErrors = validateStructuredBillingInput(structuredInput);
  const previewRecord = useMemo(() => {
    if (validationErrors.length) return null;
    try {
      return createStructuredBillingRecord(structuredInput);
    } catch {
      return null;
    }
  }, [formType, clientName, matterName, legalAidNumber, invoiceType, selectedWorkItemIds, detailsByItem, agentHearingType, additionalFactorSection, travelTimeSelected, mileageSelected, travelCourt, parking, officeDisbursements, optionalWordingNotes, wordingOverrides]);

  useEffect(() => {
    setEditableWording(previewRecord?.draft.standardWording ?? "");
  }, [previewRecord?.draft.standardWording]);

  function selectSuggestion(suggestion: BillingSuggestion) {
    setClientName(suggestion.clientName);
    setLegalAidNumber(suggestion.legalAidNumber);
    setFamNumber(suggestion.famNumber);
    setSelectedMatterId(suggestion.matter?.id ?? "");
    setSelectedClientId(suggestion.client?.id ?? "");
    setGenerationNotice("");
    setGenerationError("");
  }

  function changeClientName(value: string) {
    setClientName(value);
    setSelectedMatterId("");
    setSelectedClientId("");
  }

  function changeForm(nextFormType: BillingFormType) {
    setFormType(nextFormType);
    setSelectedWorkItemIds([]);
    setDetailsByItem({});
    setAgentHearingType(undefined);
    setAdditionalFactorSection(undefined);
    setGenerationError("");
    setGenerationNotice("");
  }

  function toggleWorkItem(id: BillingWorkItemId, checked: boolean) {
    setSelectedWorkItemIds((current) => checked ? [...current, id] : current.filter((item) => item !== id));
    const definition = billingWorkItems.find((item) => item.id === id);
    if (checked && definition?.requiresAttendance) {
      setDetailsByItem((current) => ({ ...current, [id]: current[id] ?? { ...emptyDetails } }));
    }
  }

  function updateItemDetails(id: BillingWorkItemId, field: keyof BillingItemDetails, value: string) {
    setDetailsByItem((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyDetails), [field]: value },
    }));
  }

  async function addEvidenceFiles(files: FileList | null) {
    if (!files?.length) return;
    setGenerationError("");
    const accepted: EvidenceImage[] = [];
    for (const file of Array.from(files)) {
      if (!["image/png", "image/jpeg"].includes(file.type)) {
        setGenerationError("Only PNG and JPG screenshots can be inserted into the billing form at this stage.");
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      accepted.push({
        id: `${Date.now()}-${file.name}`,
        label: file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        contentType: file.type as "image/png" | "image/jpeg",
        dataUrl,
      });
    }
    setEvidenceImages((current) => [...current, ...accepted]);
  }

  async function upsertMatterAndClient(): Promise<{ matter: MatterFile; client: BillingClientProfile }> {
    const normalizedClientName = normalizeClientName(clientName);
    const existingMatter = selectedMatter ?? matters.find((matter) =>
      normalizeClientName(matter.clientName).toLowerCase() === normalizedClientName.toLowerCase() ||
      (!!famNumber && matter.intake.famNumber === famNumber) ||
      (!!legalAidNumber && matter.legalAidNumber === legalAidNumber)
    );
    const existingClient = selectedClient ?? clients.find((client) =>
      normalizeClientName(client.clientName).toLowerCase() === normalizedClientName.toLowerCase() ||
      (!!famNumber && client.famNumber === famNumber) ||
      (!!legalAidNumber && client.legalAidNumber === legalAidNumber)
    );

    const shellMatter = createEmptyMatter();
    const shellCourt: CourtLocation = selectedTravelReference?.court === "Manukau Court"
      ? "Manukau Court"
      : selectedTravelReference?.court === "North Shore Court"
      ? "North Shore Court"
      : selectedTravelReference?.court === "Auckland Court"
      ? "Auckland Court"
      : "";
    const matter: MatterFile = existingMatter
      ? {
          ...existingMatter,
          clientName: normalizedClientName,
          legalAidNumber,
          updatedAt: new Date().toISOString(),
          intake: { ...existingMatter.intake, famNumber },
        }
      : {
          ...shellMatter,
          id: shellMatter.id,
          clientName: normalizedClientName,
          legalAidNumber,
          legalAidRequired: Boolean(legalAidNumber),
          status: "draft" as const,
          intake: {
            ...shellMatter.intake,
            famNumber,
            courtLocation: shellCourt,
            applicant: { ...shellMatter.intake.applicant, fullName: normalizedClientName },
          },
        };

    const client: BillingClientProfile = {
      ...(existingClient ?? {
        id: createBillingClientId(normalizedClientName || `client-${Date.now()}`),
        clientName: normalizedClientName,
        legalAidNumber: "",
        famNumber: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      clientName: normalizedClientName,
      legalAidNumber,
      famNumber,
      updatedAt: new Date().toISOString(),
    };

    const nextMatters = [matter, ...matters.filter((item) => item.id !== matter.id)];
    const nextClients = [client, ...clients.filter((item) => item.id !== client.id)];
    setMatters(nextMatters);
    setClients(nextClients);
    setSelectedMatterId(matter.id);
    setSelectedClientId(client.id);
    writeRecentMatters(nextMatters.filter((item) => item.id !== demoMatter.id));
    writeBillingClients(nextClients);

    await Promise.allSettled([
      fetch("/api/matters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matter, clientId: client.id }) }),
      fetch("/api/billing-clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(client) }),
    ]);

    return { matter, client };
  }

  async function persistInvoice(invoice: StoredBillingInvoice) {
    const storedInvoices = readLocal<StoredBillingInvoice>(billingInvoicesStorageKey);
    const nextInvoices = [invoice, ...storedInvoices.filter((item) => item.id !== invoice.id)];
    window.localStorage.setItem(billingInvoicesStorageKey, JSON.stringify(nextInvoices));
    await fetch("/api/billing-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoice),
    }).catch(() => undefined);
  }

  async function generateDocument() {
    if (!previewRecord) {
      setGenerationError(validationErrors[0] ?? "Complete the required billing details.");
      return;
    }
    setIsGenerating(true);
    setGenerationError("");
    setGenerationNotice("");
    try {
      const { matter } = await upsertMatterAndClient();
      const record: BillingRecord = {
        ...previewRecord,
        id: previewRecord.id,
        matterId: matter.id,
        clientName: normalizeClientName(clientName),
        legalAidNumber,
        draft: {
          ...previewRecord.draft,
          matterId: matter.id,
          clientName: normalizeClientName(clientName),
          legalAidNumber,
          matterDetails: matterLabel(matter, clientName),
          standardWording: editableWording,
        },
      };
      const response = await fetch("/api/generate-billing-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, reviewed: true, uploadToOneDrive: false, evidenceImages }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to generate the billing form.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `Completed Form${formType}.docx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(l…1435 tokens truncated…4 grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <TextField label="Client name" value={clientName} onChange={changeClientName} />
                  {clientName.trim() && suggestions.length ? (
                    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Matching matters</p>
                      {suggestions.map((suggestion) => (
                        <button key={suggestion.key} type="button" onClick={() => selectSuggestion(suggestion)} className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-white">
                          <span className="block font-semibold text-slate-900">{suggestion.label}</span>
                          <span className="block text-xs text-slate-500">{suggestion.detail || "Select this client"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <TextField label="Legal aid number" value={legalAidNumber} onChange={setLegalAidNumber} />
                <TextField label="FAM number" value={famNumber} onChange={setFamNumber} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Matter name is now taken from the selected matter/client profile. If this client has not been intaken, generating the form creates a shell matter so future billing and OneDrive storage can still attach to the right file.</p>
              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-slate-700">Billing form</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["32B", "33A"] as BillingFormType[]).map((value) => (
                    <label key={value} className={formType === value ? "flex h-12 cursor-pointer items-center justify-center rounded-md border border-sky-500 bg-sky-50 font-semibold text-sky-800" : "flex h-12 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white font-semibold text-slate-700"}>
                      <input className="sr-only" type="radio" name="form-type" checked={formType === value} onChange={() => changeForm(value)} />
                      Form {value}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-slate-700">Invoice type</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["interim", "final"] as const).map((value) => (
                    <label key={value} className={invoiceType === value ? "flex h-11 cursor-pointer items-center justify-center rounded-md border border-sky-500 bg-sky-50 font-semibold text-sky-800" : "flex h-11 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white font-semibold text-slate-700"}>
                      <input className="sr-only" type="radio" name="invoice-type" checked={invoiceType === value} onChange={() => setInvoiceType(value)} />
                      {value === "interim" ? "Interim invoice" : "Final invoice"}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">2. Work completed</h2>
              <p className="mt-2 text-sm text-slate-600">Selectionsâ€”not keyword detectionâ€”control the billing rows.</p>
              <div className="mt-5 space-y-6">
                {Object.entries(groupedItems).map(([group, items]) => (
                  <fieldset key={group}>
                    <legend className="text-sm font-semibold text-slate-950">{group}</legend>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.id} className={selectedWorkItemIds.includes(item.id) ? "flex cursor-pointer items-start gap-3 rounded-md border border-sky-300 bg-sky-50 p-3" : "flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50"}>
                          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600" checked={selectedWorkItemIds.includes(item.id)} onChange={(event) => toggleWorkItem(item.id, event.target.checked)} />
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{item.label}</span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {item.fixedFee ? `$${item.fixedFee} fixed fee` : item.preparationFee ? `$${item.preparationFee} preparation + $${item.hearingRate} per half hour` : `$${item.hearingRate} per half hour`}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>

            {selectedWorkItemIds.some((id) => billingWorkItems.find((item) => item.id === id)?.requiresAttendance) ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <h2 className="text-lg font-semibold text-slate-950">3. Hearing details</h2>
                <div className="mt-4 space-y-4">
                  {selectedWorkItemIds.map((id) => billingWorkItems.find((item) => item.id === id)).filter((item) => item?.requiresAttendance).map((item) => item ? (
                    <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-semibold text-slate-950">{item.label}</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Input label="Date" type="date" value={detailsByItem[item.id]?.date ?? today} onChange={(value) => updateItemDetails(item.id, "date", value)} />
                        <Input label="Start time" type="time" value={detailsByItem[item.id]?.startTime ?? ""} onChange={(value) => updateItemDetails(item.id, "startTime", value)} />
                        <Input label="End time" type="time" value={detailsByItem[item.id]?.endTime ?? ""} onChange={(value) => updateItemDetails(item.id, "endTime", value)} />
                      </div>
                    </div>
                  ) : null)}
                </div>
              </section>
            ) : null}

            {selectedWorkItemIds.includes("33-instructing-agent") || selectedWorkItemIds.includes("33-additional-factors") ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
                <h2 className="text-lg font-semibold text-slate-950">3. Item options</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {selectedWorkItemIds.includes("33-instructing-agent") ? <SelectField label="Agent attended" value={agentHearingType ?? ""} options={["judicial_conference", "formal_proof", "defended_hearing"]} optionLabels={{ judicial_conference: "Judicial Conference", formal_proof: "Formal Proof Hearing", defended_hearing: "Defended Hearing" }} onChange={(value) => setAgentHearingType(value as StructuredBillingInput["agentHearingType"])} /> : null}
                  {selectedWorkItemIds.includes("33-additional-factors") ? <SelectField label="Additional factors apply to" value={additionalFactorSection ?? ""} options={["applications_orders", "pre_hearing", "defended_hearing"]} optionLabels={{ applications_orders: "Applications/orders", pre_hearing: "Pre-hearing", defended_hearing: "Defended hearing" }} onChange={(value) => setAdditionalFactorSection(value as StructuredBillingInput["additionalFactorSection"])} /> : null}
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">4. Travel, disbursements and evidence</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CheckField label="Travel time" checked={travelTimeSelected} onChange={setTravelTimeSelected} detail="$63 per hour; GST applies" />
                <CheckField label="Mileage" checked={mileageSelected} onChange={setMileageSelected} detail="$1.20 per km; no GST" />
              </div>
              {travelTimeSelected ? <div className="mt-4 max-w-md"><SelectField label="Court" value={travelCourt} options={travelReferences.map((court) => court.court)} onChange={setTravelCourt} />{selectedTravelReference ? <p className="mt-2 text-sm text-slate-600">Travel to {selectedTravelReference.court}, return. Return travel: {selectedTravelReference.returnTravelTime}; return distance: {selectedTravelReference.returnDistance}.</p> : null}</div> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <NumberField label="Parking amount" value={parking} onChange={setParking} />
                <NumberField label="Other disbursement amount" value={officeDisbursements} onChange={setOfficeDisbursements} />
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Optional wording notes<textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={optionalWordingNotes} onChange={(event) => setOptionalWordingNotes(event.target.value)} placeholder="Optional onlyâ€”work-item selection remains the source of truth." /></label>

              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-semibold text-slate-900">Court direction / supporting screenshot</label>
                <p className="mt-1 text-xs leading-5 text-slate-500">Optional. Upload PNG or JPG screenshots only when a billing item needs supporting court wording. They are appended after the final billing page.</p>
                <input type="file" accept="image/png,image/jpeg" multiple className="mt-3 block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" onChange={(event) => void addEvidenceFiles(event.target.files)} />
                {evidenceImages.length ? (
                  <div className="mt-3 space-y-2">
                    {evidenceImages.map((file) => (
                      <div key={file.id} className="grid gap-2 rounded border border-slate-200 bg-white p-2 sm:grid-cols-[1fr_auto]">
                        <label className="text-xs font-medium text-slate-600">Label<input className="mt-1 h-9 w-full rounded border border-slate-300 px-2 text-sm" value={file.label} onChange={(event) => setEvidenceImages((current) => current.map((item) => item.id === file.id ? { ...item, label: event.target.value } : item))} /></label>
                        <button type="button" className="self-end rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" onClick={() => setEvidenceImages((current) => current.filter((item) => item.id !== file.id))}>Remove</button>
                        <p className="text-xs text-slate-500 sm:col-span-2">{file.fileName}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <PreviewPanel record={previewRecord} errors={validationErrors} editableWording={editableWording} onWordingChange={setEditableWording} />
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-white p-4 text-sm shadow-form">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600" checked={createClaimRecord} onChange={(event) => setCreateClaimRecord(event.target.checked)} />
              <span><span className="block font-semibold text-slate-900">Track payment in Billing Register</span><span className="mt-1 block text-xs leading-5 text-slate-500">Creates the payment fields for this generated form so it can be marked sent, part paid, paid, or overdue later.</span></span>
            </label>
            <button type="button" disabled={isGenerating || !previewRecord} onClick={generateDocument} className="inline-flex h-12 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isGenerating ? "Generating..." : `Generate Form${formType}`}</button>
            {generatedRecord && oneDriveConfigured ? <button type="button" disabled={isSavingToOneDrive} onClick={() => void saveGeneratedToOneDrive()} className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isSavingToOneDrive ? "Savingâ€¦" : "Save generated form to OneDrive"}</button> : null}
            {generatedInvoiceId ? <Link href={`/billing/register?record=${encodeURIComponent(generatedInvoiceId)}`} className="inline-flex h-11 w-full items-center justify-center rounded-md border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800 hover:bg-sky-100">Open in Billing Register</Link> : null}
            {generationError ? <p className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700">{generationError}</p> : null}
            {generationNotice ? <p className="rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{generationNotice}</p> : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function PreviewPanel({ record, errors, editableWording, onWordingChange }: { record: BillingRecord | null; errors: string[]; editableWording: string; onWordingChange: (value: string) => void }) {
  if (!record) return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form"><h2 className="text-lg font-semibold text-slate-950">Preview</h2><div className="mt-4 space-y-2">{errors.map((error) => <p key={error} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>)}</div></section>;
  const rows = getBillingPreviewRows(record);
  const totals = calculateBillingTotals(record);
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">Form{record.formType} preview</h2><p className="mt-1 text-xs text-slate-500">{record.invoiceNumber}</p></div><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">Ready</span></div>
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Row</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label} className="border-t border-slate-100"><td className="px-3 py-2 text-slate-800">{row.label}</td><td className="px-2 py-2 text-right">{row.quantity}</td><td className="px-2 py-2 text-right">${row.unit.toFixed(2)}</td><td className="px-3 py-2 text-right font-medium">${row.total.toFixed(2)}</td></tr>)}</tbody></table></div>
    <dl className="mt-4 space-y-2 text-sm"><Total label="Application fees (ta)" value={totals.totalApplication} /><Total label="Disbursements excluding mileage (td)" value={totals.totalDisbursementsExcludingMileage} /><Total label="GST (15%)" value={totals.totalGst} /><Total label="Mileage (m_t, no GST)" value={totals.totalMileage} /><Total label="Final payable" value={totals.total} strong /></dl>
    <div className="mt-5"><p className="text-sm font-medium text-slate-700">Generated wording preview</p><div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">{record.draft.standardWording}</div></div>
    <label className="mt-5 block text-sm font-medium text-slate-700">Final wording inserted into the form<textarea className="mt-2 min-h-56 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6" value={editableWording} onChange={(event) => onWordingChange(event.target.value)} /><span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Review and edit this text if needed. This exact final version is inserted into the wording section at the end of the generated form.</span></label>
  </section>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Input({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-medium text-slate-700">{label}<input type={type} className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, value, options, optionLabels = {}, onChange }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-slate-700">{label}<select className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select...</option>{options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? option}</option>)}</select></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block text-sm font-medium text-slate-700">{label}<div className="relative mt-2"><span className="absolute left-3 top-2.5 text-sm text-slate-500">$</span><input type="number" min="0" step="0.01" className="h-10 w-full rounded-md border border-slate-300 pl-7 pr-3 text-sm" value={value || ""} onChange={(event) => onChange(Number(event.target.value) || 0)} /></div></label>; }
function CheckField({ label, checked, onChange, detail }: { label: string; checked: boolean; onChange: (value: boolean) => void; detail: string }) { return <label className={checked ? "flex cursor-pointer gap-3 rounded-md border border-sky-300 bg-sky-50 p-3" : "flex cursor-pointer gap-3 rounded-md border border-slate-200 p-3"}><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><span className="block text-sm font-medium text-slate-900">{label}</span><span className="text-xs text-slate-500">{detail}</span></span></label>; }
function Total({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={strong ? "flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-950" : "flex justify-between text-slate-700"}><dt>{label}</dt><dd>${value.toFixed(2)}</dd></div>; }

