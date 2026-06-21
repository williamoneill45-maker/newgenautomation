"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { travelReferences, type BillingFormType, type BillingRecord } from "../../lib/billing-automation";
import { calculateBillingTotals } from "../../lib/billing-document";
import {
  billingInvoicesStorageKey,
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
import { form32BSettingsStorageKey } from "../../lib/form32b-rules";
import { form33ASettingsStorageKey } from "../../lib/form33a-rules";

const today = new Date().toISOString().slice(0, 10);
const emptyDetails: BillingItemDetails = { date: today, court: "", startTime: "", endTime: "" };

function makeInvoiceNumber(formType: BillingFormType, clientName: string): string {
  const surname = clientName.trim().split(/\s+/).pop()?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "CLIENT";
  return `${today.replace(/-/g, "")}.${formType}.${surname}`;
}

export default function BillingPage() {
  const [formType, setFormType] = useState<BillingFormType>("32B");
  const [clientName, setClientName] = useState("");
  const [legalAidNumber, setLegalAidNumber] = useState("");
  const [selectedWorkItemIds, setSelectedWorkItemIds] = useState<BillingWorkItemId[]>([]);
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
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const formItems = billingWorkItems.filter((item) => item.formType === formType);
  const groupedItems = useMemo(() => formItems.reduce<Record<string, typeof formItems>>((groups, item) => {
    groups[item.group] = [...(groups[item.group] ?? []), item];
    return groups;
  }, {}), [formType]);
  const selectedTravelReference = travelReferences.find((reference) => reference.court === travelCourt);

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
  }, []);

  const structuredInput: StructuredBillingInput = {
    formType,
    clientName,
    legalAidNumber,
    invoiceNumber: makeInvoiceNumber(formType, clientName),
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
  }, [formType, clientName, legalAidNumber, selectedWorkItemIds, detailsByItem, agentHearingType, additionalFactorSection, travelTimeSelected, mileageSelected, travelCourt, parking, officeDisbursements, optionalWordingNotes, wordingOverrides]);

  useEffect(() => {
    setEditableWording(previewRecord?.draft.standardWording ?? "");
  }, [previewRecord?.draft.standardWording]);

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

  async function generateDocument() {
    if (!previewRecord) {
      setGenerationError(validationErrors[0] ?? "Complete the required billing details.");
      return;
    }
    setIsGenerating(true);
    setGenerationError("");
    setGenerationNotice("");
    const record: BillingRecord = {
      ...previewRecord,
      draft: { ...previewRecord.draft, standardWording: editableWording },
    };
    try {
      const response = await fetch("/api/generate-billing-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record, reviewed: true }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Unable to generate the billing form.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `Completed Form${formType}.docx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const totals = calculateBillingTotals(record);
      const oneDriveStatus = response.headers.get("X-OneDrive-Status") ?? "not_configured";
      const invoice: StoredBillingInvoice = {
        id: record.id,
        clientId: record.matterId,
        clientName: record.clientName,
        legalAidNumber: record.legalAidNumber,
        famNumber: "",
        invoiceNumber: record.invoiceNumber,
        invoiceTotal: totals.total,
        formType: record.formType,
        status: oneDriveStatus === "uploaded" ? "onedrive_uploaded" : "onedrive_pending",
        missingEvidence: [],
        evidenceFiles: [],
        billingRecord: record,
        oneDriveUrl: decodeURIComponent(response.headers.get("X-OneDrive-Url") ?? ""),
        oneDrivePath: decodeURIComponent(response.headers.get("X-OneDrive-Path") ?? ""),
        generatedFileName: fileName,
        generatedAt: new Date().toISOString(),
      };
      let storedInvoices: StoredBillingInvoice[] = [];
      try {
        storedInvoices = JSON.parse(window.localStorage.getItem(billingInvoicesStorageKey) ?? "[]") as StoredBillingInvoice[];
      } catch {
        window.localStorage.removeItem(billingInvoicesStorageKey);
      }
      window.localStorage.setItem(
        billingInvoicesStorageKey,
        JSON.stringify([invoice, ...storedInvoices.filter((item) => item.id !== invoice.id)]),
      );
      fetch("/api/billing-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice),
      }).catch(() => undefined);
      setGenerationNotice(`Generated ${fileName}. The wording remains editable in Word.`);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unable to generate the billing form.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-900">Back to dashboard</Link>
          <div className="flex gap-3 text-sm font-medium text-slate-600">
            <Link href="/invoices" className="hover:text-slate-950">Invoices</Link>
            <Link href="/billing-management/form-32b" className="hover:text-slate-950">Billing rules</Link>
          </div>
        </div>

        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Legal aid billing</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Structured Billing</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Select the work completed and enter only the details needed for those items. Fees, units, GST, mileage, totals, wording, and Word placeholders are calculated automatically.</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">1. Client and form</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField label="Client name" value={clientName} onChange={setClientName} />
                <TextField label="Legal aid number" value={legalAidNumber} onChange={setLegalAidNumber} />
              </div>
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
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-form">
              <h2 className="text-lg font-semibold text-slate-950">2. Work completed</h2>
              <p className="mt-2 text-sm text-slate-600">Selections—not keyword detection—control the billing rows.</p>
              <div className="mt-5 space-y-6">
                {Object.entries(groupedItems).map(([group, items]) => (
                  <fieldset key={group}>
                    <legend className="text-sm font-semibold text-slate-950">{group}</legend>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.id} className={selectedWorkItemIds.includes(item.id) ? "flex cursor-pointer items-start gap-3 rounded-md border border-sky-300 bg-sky-50 p-3" : "flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50"}>
                          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600" checked={selectedWorkItemIds.includes(item.id)} onChange={(event) => toggleWorkItem(item.id, event.target.checked)} />
                          <span><span className="block text-sm font-medium text-slate-900">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.fixedFee ? `$${item.fixedFee} fixed fee` : `$${item.preparationFee} preparation + $${item.hearingRate} per half hour`}</span></span>
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
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Input label="Date" type="date" value={detailsByItem[item.id]?.date ?? today} onChange={(value) => updateItemDetails(item.id, "date", value)} />
                        <SelectField label="Court" value={detailsByItem[item.id]?.court ?? ""} options={travelReferences.map((court) => court.court)} onChange={(value) => updateItemDetails(item.id, "court", value)} />
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
              <h2 className="text-lg font-semibold text-slate-950">4. Travel and disbursements</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <CheckField label="Travel time" checked={travelTimeSelected} onChange={setTravelTimeSelected} detail="$63 per hour; GST applies" />
                <CheckField label="Mileage" checked={mileageSelected} onChange={setMileageSelected} detail="$1.17 per km; no GST" />
              </div>
              {travelTimeSelected || mileageSelected ? <div className="mt-4 max-w-md"><SelectField label="Court for return travel" value={travelCourt} options={travelReferences.map((court) => court.court)} onChange={setTravelCourt} />{selectedTravelReference ? <p className="mt-2 text-sm text-slate-600">Return travel: {selectedTravelReference.returnTravelTime}; return distance: {selectedTravelReference.returnDistance}.</p> : null}</div> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <NumberField label="Parking amount" value={parking} onChange={setParking} />
                <NumberField label="Other disbursement amount" value={officeDisbursements} onChange={setOfficeDisbursements} />
              </div>
              <label className="mt-4 block text-sm font-medium text-slate-700">Optional wording notes<textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={optionalWordingNotes} onChange={(event) => setOptionalWordingNotes(event.target.value)} placeholder="Optional only—work-item selection remains the source of truth." /></label>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <PreviewPanel record={previewRecord} errors={validationErrors} editableWording={editableWording} onWordingChange={setEditableWording} />
            <button type="button" disabled={isGenerating || !previewRecord} onClick={generateDocument} className="inline-flex h-12 w-full items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isGenerating ? "Generating..." : `Generate Form${formType}`}</button>
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
