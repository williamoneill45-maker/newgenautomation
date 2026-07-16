import {
  billingTemplatePaths,
  travelReferences,
  type BillingCategory,
  type BillingFormType,
  type BillingRecord,
} from "./billing-automation.ts";

export type BillingWorkItemId =
  | "32-pre-hearing-matters"
  | "32-judge-directions"
  | "32-instructing-agent"
  | "32-formal-proof"
  | "32-settlement-conference"
  | "32-directions-conference"
  | "32-pre-hearing-conference"
  | "32-memorandum-consent"
  | "32-report"
  | "32-additional-factors"
  | "32-defended-hearing"
  | "33-judicial-conference"
  | "33-pre-hearing-matters"
  | "33-formal-proof"
  | "33-defended-protection-order"
  | "33-judge-directions"
  | "33-defended-hearing"
  | "33-instructing-agent"
  | "33-additional-factors";

export type BillingWorkItemDefinition = {
  id: BillingWorkItemId;
  formType: BillingFormType;
  group: string;
  label: string;
  category: BillingCategory;
  wording: string;
  managementRuleId: string;
  fixedFee?: number;
  preparationFee?: number;
  hearingRate?: number;
  requiresAttendance?: boolean;
  requiresAgentType?: boolean;
  requiresAdditionalFactorSection?: boolean;
};

export const billingWorkItems: BillingWorkItemDefinition[] = [
  { id: "32-pre-hearing-matters", managementRuleId: "pre-hearing-matters", formType: "32B", group: "Pre-hearing matters", label: "Pre-Hearing Matters", category: "pre_hearing_matters", fixedFee: 620, wording: "Received defended Application - All correspondence and phone calls with client, court and counsel with respect to these proceedings. Advise client and instruct Counsel as to the Direction of the proceedings. Inform the Court of Direction required to advance the proceedings." },
  { id: "32-judge-directions", managementRuleId: "complying-judges-directions", formType: "32B", group: "Pre-hearing matters", label: "Complying with Judge's directions", category: "complying_judges_directions", fixedFee: 190, wording: "Complying with Judges directions - the Court directed that parties file further evidence via an affidavit. This has now been completed." },
  { id: "32-instructing-agent", managementRuleId: "instructing-agent", formType: "32B", group: "Pre-hearing matters", label: "Instructing agent", category: "instructing_agent", fixedFee: 190, requiresAttendance: true, wording: "Enclosed Notice of Fixture, Agents Report and invoice. Directions made as per Agent's Report. Briefing Agent - preparing written brief for Counsel. Attendance at Directions Conference on [billing date] from [attendance time]." },
  { id: "32-formal-proof", managementRuleId: "formal-proof", formType: "32B", group: "Formal proof", label: "Formal proof hearing", category: "formal_proof", preparationFee: 140, hearingRate: 67, requiresAttendance: true, wording: "Preparing for Formal Proof, taking client's instructions, advising of procedural steps, advising of what will take place at the Formal Proof hearing. All correspondence and calls with Counsel and parties. Enclosed Notice of Fixture. Directions made. Attendance at Formal Proof on [billing date] from [attendance time]." },
  { id: "32-settlement-conference", managementRuleId: "settlement-conference", formType: "32B", group: "Conferences", label: "Settlement Conference / Round Table Meeting", category: "settlement_conference", preparationFee: 210, hearingRate: 67, requiresAttendance: true, wording: "Prep settlement conference - review affidavit evidence, advise client of format and rules of engagement for meeting, seek client's instructions and advise client of strategy for the Settlement Conference. Attendance at Settlement Conference on [billing date] from [attendance time]." },
  { id: "32-directions-conference", managementRuleId: "directions-conference", formType: "32B", group: "Conferences", label: "Directions Conference", category: "directions_conference", preparationFee: 140, hearingRate: 67, requiresAttendance: true, wording: "Preparing for Directions Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties. Enclosed Notice of Fixture, Directions granted to advance the proceedings. Attendance at Directions Conference on [billing date] from [attendance time]." },
  { id: "32-pre-hearing-conference", managementRuleId: "pre-hearing-conference", formType: "32B", group: "Conferences", label: "Pre-Hearing Conference", category: "pre_hearing_conference", preparationFee: 140, hearingRate: 67, requiresAttendance: true, wording: "All correspondence and phone calls with client, court and counsel with respect to these proceedings. Advise client and instruct Counsel as to the Direction of the proceedings. Inform the Court of Direction required to advance the proceedings." },
  { id: "32-memorandum-consent", managementRuleId: "memorandum-of-consent", formType: "32B", group: "Consent", label: "Memorandum of Consent", category: "consent_memorandum", fixedFee: 310, wording: "The parties and Counsel have negotiated a consent memorandum to advance proceedings." },
  { id: "32-report", managementRuleId: "report", formType: "32B", group: "Reports", label: "Report (s 132, s 133, or Lawyer for Child)", category: "lawyer_for_child_report", fixedFee: 190, wording: "Receipt of report. Perusing report. Considering recommendations. Advising client of impact of report on proceedings." },
  { id: "32-additional-factors", managementRuleId: "additional-factors", formType: "32B", group: "Additional factors", label: "Additional factors", category: "additional_factors", fixedFee: 190, wording: "The Respondent is self represented and this makes negotiations very challenging and is causing delays in advancing proceedings." },
  { id: "32-defended-hearing", managementRuleId: "defended-hearing", formType: "32B", group: "Defended hearing", label: "Defended Hearing", category: "defended_hearing", hearingRate: 67, requiresAttendance: true, wording: "Defended Hearing - attendance at the Fixture on [billing date] from [attendance time]." },
  { id: "33-judicial-conference", managementRuleId: "judicial-conference", formType: "33A", group: "Pre-hearing matters", label: "Judicial Conference", category: "judicial_conference", preparationFee: 140, hearingRate: 67, requiresAttendance: true, wording: "Preparing for Judicial Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties. Enclosed Notice of Fixture, Directions granted to advance the proceedings. Attendance at Judicial Conference on [billing date] from [attendance time]." },
  { id: "33-pre-hearing-matters", managementRuleId: "pre-hearing-matters", formType: "33A", group: "Pre-hearing matters", label: "Pre-hearing matters", category: "pre_hearing_matters", fixedFee: 620, wording: "Pre-hearing matters including reviewing evidence, advising client, correspondence with parties and preparing matter for next procedural step." },
  { id: "33-formal-proof", managementRuleId: "formal-proof", formType: "33A", group: "Applications and orders", label: "Formal proof hearing", category: "formal_proof", preparationFee: 140, hearingRate: 67, requiresAttendance: true, wording: "Formal Proof Hearing preparation, taking instructions, reviewing evidence, preparing for hearing, attendance at hearing on [billing date] from [attendance time]." },
  { id: "33-defended-protection-order", managementRuleId: "defended-protection-order", formType: "33A", group: "Applications and orders", label: "Defended Protection Order", category: "defended_protection_order", fixedFee: 430, wording: "Defended protection order preparation, reviewing application and evidence, advising client, correspondence and attendance-related preparation." },
  { id: "33-judge-directions", managementRuleId: "judge-directions", formType: "33A", group: "Defended hearings", label: "Complying with Judge's directions", category: "complying_judges_directions", fixedFee: 190, wording: "Complying with Judge's directions, reviewing directions, completing required work, correspondence and reporting to client." },
  { id: "33-defended-hearing", managementRuleId: "defended-hearing", formType: "33A", group: "Defended hearings", label: "Defended hearing", category: "defended_hearing", preparationFee: 160, hearingRate: 67, requiresAttendance: true, wording: "Defended hearing - review file, prepare for defended hearing, cross examination, brief witness, drafting submissions and reporting to client. Attendance at the defended hearing on [billing date] from [attendance time]." },
  { id: "33-instructing-agent", managementRuleId: "instructing-agent", formType: "33A", group: "Agent attendances", label: "Instructing agent", category: "instructing_agent", fixedFee: 190, requiresAgentType: true, wording: "Instructing agent to attend on behalf of counsel, reviewing agent report, correspondence and reporting to client." },
  { id: "33-additional-factors", managementRuleId: "additional-factors", formType: "33A", group: "Additional factors", label: "Additional factors", category: "additional_factors", fixedFee: 190, requiresAdditionalFactorSection: true, wording: "Additional factors including additional complexity, party conduct, self-represented party issues, or additional work required to progress the matter." },
];

export type BillingItemDetails = { date: string; court: string; startTime: string; endTime: string };

export type StructuredBillingInput = {
  formType: BillingFormType;
  clientName: string;
  legalAidNumber: string;
  matterName?: string;
  invoiceNumber: string;
  selectedWorkItemIds: BillingWorkItemId[];
  detailsByItem: Partial<Record<BillingWorkItemId, BillingItemDetails>>;
  agentHearingType?: "judicial_conference" | "formal_proof" | "defended_hearing";
  additionalFactorSection?: "applications_orders" | "pre_hearing" | "defended_hearing";
  travelTimeSelected: boolean;
  mileageSelected: boolean;
  travelCourt: string;
  parking: number;
  officeDisbursements: number;
  optionalWordingNotes?: string;
  wordingOverrides?: Partial<Record<BillingWorkItemId, string>>;
};

function timeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateAttendanceHours(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) / 60;
}

export function calculateHalfHourUnits(hours: number): number {
  return hours > 0 ? Math.max(1, Math.ceil(hours * 2)) : 0;
}

export function validateStructuredBillingInput(input: StructuredBillingInput): string[] {
  const errors: string[] = [];
  if (!input.clientName.trim()) errors.push("Enter the client name.");
  if (!input.selectedWorkItemIds.length) errors.push("Select at least one work item.");
  const definitions = billingWorkItems.filter((item) => input.selectedWorkItemIds.includes(item.id));
  definitions.filter((item) => item.requiresAttendance).forEach((item) => {
    const details = input.detailsByItem[item.id];
    if (!details?.date) errors.push(`${item.label}: select the billing date.`);
    if (!details?.startTime || !details?.endTime) errors.push(`${item.label}: enter the start and end time.`);
    else if (!calculateAttendanceHours(details.startTime, details.endTime)) errors.push(`${item.label}: the end time must be after the start time.`);
  });
  if (input.selectedWorkItemIds.includes("33-instructing-agent") && !input.agentHearingType) errors.push("Select the hearing type attended by the agent.");
  if (input.selectedWorkItemIds.includes("33-additional-factors") && !input.additionalFactorSection) errors.push("Select the section for the additional factors.");
  if (input.travelTimeSelected && !input.travelCourt) errors.push("Select the court for Travel Time.");
  if (input.parking < 0 || input.officeDisbursements < 0) errors.push("Disbursement amounts cannot be negative.");
  return errors;
}

function applyTokens(wording: string, details?: BillingItemDetails): string {
  return wording
    .replace(/\[billing date\]/gi, details?.date ?? "")
    .replace(/\[attendance time\]/gi, details?.startTime && details.endTime ? `${details.startTime}-${details.endTime}` : "")
    .replace(/\[court\]/gi, details?.court.toLocaleUpperCase("en-NZ") ?? "");
}

export function createStructuredBillingRecord(input: StructuredBillingInput): BillingRecord {
  const errors = validateStructuredBillingInput(input);
  if (errors.length) throw new Error(errors.join(" "));
  const definitions = billingWorkItems.filter((item) => input.selectedWorkItemIds.includes(item.id));
  const workItems = definitions.map((item) => {
    const details = input.detailsByItem[item.id] ?? { date: "", court: "", startTime: "", endTime: "" };
    return {
      id: item.id,
      label: item.label,
      ...details,
      attendanceHours: calculateAttendanceHours(details.startTime, details.endTime),
      wording: applyTokens(input.wordingOverrides?.[item.id] ?? item.wording, details),
    };
  });
  const firstAttendance = workItems.find((item) => item.attendanceHours > 0) ?? workItems[0];
  const categories = Array.from(new Set(definitions.map((item) => item.category)));
  const travelReference = travelReferences.find((reference) => reference.court === input.travelCourt);
  const travel = travelReference && input.travelTimeSelected
    ? {
        ...travelReference,
        travelTimeBillingRow: input.travelTimeSelected ? travelReference.travelTimeBillingRow : "",
        travelTimeValue: input.travelTimeSelected ? travelReference.travelTimeValue : 0,
        returnTravelHours: input.travelTimeSelected ? travelReference.returnTravelHours : 0,
        returnTravelTime: input.travelTimeSelected ? travelReference.returnTravelTime : "",
        mileageBillingRow: input.mileageSelected ? travelReference.mileageBillingRow : "",
        mileageValue: input.mileageSelected ? travelReference.mileageValue : 0,
        returnKm: input.mileageSelected ? travelReference.returnKm : 0,
        returnDistance: input.mileageSelected ? travelReference.returnDistance : "",
        progressResultsWording: `Travel to ${travelReference.court.replace(/\s+Court$/i, "")} Court, return.`,
      }
    : undefined;
  const standardWording = [
    ...workItems.map((item) => item.wording),
    input.optionalWordingNotes?.trim() ?? "",
  ].filter(Boolean).join("\n\n");
  const now = new Date().toISOString();
  const category = categories[0] ?? "general_billing_entry";
  const recordId = `billing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: recordId,
    matterId: recordId,
    clientName: input.clientName.trim(),
    legalAidNumber: input.legalAidNumber.trim(),
    invoiceNumber: input.invoiceNumber.trim(),
    formType: input.formType,
    status: "ready_to_review",
    draft: {
      sourcePrompt: "Structured billing selection",
      matterId: recordId,
      clientName: input.clientName.trim().toLocaleUpperCase("en-NZ"),
      legalAidNumber: input.legalAidNumber.trim(),
      invoiceNumber: input.invoiceNumber.trim(),
      matterDetails: input.matterName?.trim() ?? "",
      proceedingType: "Family Court",
      formType: input.formType,
      category,
      categoryLabel: definitions[0]?.label ?? "Billing item",
      categories,
      categoryLabels: definitions.map((item) => item.label),
      court: input.travelTimeSelected ? input.travelCourt : "",
      date: firstAttendance?.date || new Date().toISOString().slice(0, 10),
      startTime: firstAttendance?.startTime ?? "",
      endTime: firstAttendance?.endTime ?? "",
      attendanceHours: firstAttendance?.attendanceHours ?? 0,
      travel,
      parking: input.parking || 0,
      officeDisbursements: input.officeDisbursements || 0,
      standardWording,
      evidenceRequirements: [],
      status: "ready_to_review",
      templateStatus: "Ready",
      warnings: [],
      structuredSelection: {
        workItems,
        agentHearingType: input.agentHearingType,
        additionalFactorSection: input.additionalFactorSection,
        travelTimeSelected: input.travelTimeSelected,
        mileageSelected: input.mileageSelected,
      },
    },
    evidence: [],
    evidenceStoragePaths: [],
    templatePath: billingTemplatePaths[input.formType],
    createdAt: now,
    updatedAt: now,
  };
}

export type BillingPreviewRow = { label: string; quantity: number; unit: number; total: number };

export function getBillingPreviewRows(record: BillingRecord): BillingPreviewRow[] {
  const selected = record.draft.structuredSelection?.workItems ?? [];
  const workRows = selected.flatMap((item) => {
    const definition = billingWorkItems.find((candidate) => candidate.id === item.id);
    if (!definition) return [];
    if (definition.fixedFee) return [{ label: definition.label, quantity: 1, unit: definition.fixedFee, total: definition.fixedFee }];
    const units = calculateHalfHourUnits(item.attendanceHours);
    return [
      definition.preparationFee
        ? { label: `${definition.label} - Preparation`, quantity: 1, unit: definition.preparationFee, total: definition.preparationFee }
        : null,
      { label: `${definition.label} - Hearing time`, quantity: units, unit: definition.hearingRate ?? 0, total: units * (definition.hearingRate ?? 0) },
    ].filter((row): row is BillingPreviewRow => Boolean(row));
  });
  const additionalRows: BillingPreviewRow[] = [];
  if ((record.draft.travel?.travelTimeValue ?? 0) > 0) additionalRows.push({ label: "Travel time", quantity: record.draft.travel?.travelTimeValue ?? 0, unit: 63, total: (record.draft.travel?.travelTimeValue ?? 0) * 63 });
  if (record.draft.parking > 0) additionalRows.push({ label: "Parking", quantity: 1, unit: record.draft.parking, total: record.draft.parking });
  if (record.draft.officeDisbursements > 0) additionalRows.push({ label: "Other disbursements", quantity: 1, unit: record.draft.officeDisbursements, total: record.draft.officeDisbursements });
  if ((record.draft.travel?.mileageValue ?? 0) > 0) additionalRows.push({ label: "Mileage (no GST)", quantity: record.draft.travel?.mileageValue ?? 0, unit: 1.17, total: (record.draft.travel?.mileageValue ?? 0) * 1.17 });
  return [...workRows, ...additionalRows];
}

export function validateStructuredBillingRecord(record: BillingRecord): string[] {
  const selection = record.draft.structuredSelection;
  if (!selection) return [];
  const errors: string[] = [];
  if (!selection.workItems.length) errors.push("Select at least one work item.");
  selection.workItems.forEach((item) => {
    const definition = billingWorkItems.find((candidate) => candidate.id === item.id);
    if (!definition?.requiresAttendance) return;
    if (!item.date || !item.startTime || !item.endTime || item.attendanceHours <= 0) {
      errors.push(`${item.label}: date, start time, and end time are required.`);
    }
  });
  if (selection.workItems.some((item) => item.id === "33-instructing-agent") && !selection.agentHearingType) errors.push("Select the agent hearing type.");
  if (selection.workItems.some((item) => item.id === "33-additional-factors") && !selection.additionalFactorSection) errors.push("Select the additional-factor section.");
  if (selection.travelTimeSelected && !record.draft.travel?.court) errors.push("Select a supported court for Travel Time.");
  return errors;
}

