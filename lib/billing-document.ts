import type { MergeFields, MergeFieldTextValue } from "./document-automation.ts";
import {
  billingTemplatePaths,
  type BillingFormType,
  type BillingRecord,
} from "./billing-automation.ts";
import { form32BFeeRules } from "./form32b-rules.ts";
import { form33AFeeRules } from "./form33a-rules.ts";

export const approvedBillingPlaceholderKeys = [
  "BILLING_RECORD_ID",
  "billing_record_id",
  "MATTER_ID",
  "matter_id",
  "CLIENT_NAME",
  "client_name",
  "LEGAL_AID_NUMBER",
  "legal_aid_number",
  "INVOICE_NUMBER",
  "invoice_number",
  "MATTER_DETAILS",
  "matter_details",
  "PROCEEDING_TYPE",
  "proceeding_type",
  "FORM_TYPE",
  "form_type",
  "CATEGORY_LABEL",
  "category_label",
  "COURT",
  "court",
  "BILLING_DATE",
  "billing_date",
  "START_TIME",
  "start_time",
  "END_TIME",
  "end_time",
  "ATTENDANCE_TIME",
  "attendance_time",
  "ATTENDANCE_HOURS",
  "attendance_hours",
  "TRAVEL_RETURN_KM",
  "travel_return_km",
  "TRAVEL_RETURN_HOURS",
  "travel_return_hours",
  "TRAVEL_TIME_BILLING_ROW",
  "travel_time_billing_row",
  "TRAVEL_TIME_VALUE",
  "travel_time_value",
  "RETURN_TRAVEL_TIME",
  "return_travel_time",
  "MILEAGE_BILLING_ROW",
  "mileage_billing_row",
  "MILEAGE_VALUE",
  "mileage_value",
  "RETURN_DISTANCE",
  "return_distance",
  "TRAVEL_PROGRESS_WORDING",
  "travel_progress_wording",
  "PARKING",
  "parking",
  "OFFICE_DISBURSEMENTS",
  "office_disbursements",
  "od",
  "TOTAL_DISBURSEMENTS",
  "total_disbursements",
  "STANDARD_WORDING",
  "standard_wording",
  "EVIDENCE_STATUS",
  "evidence_status",
  "TEMPLATE_PATH",
  "template_path",
  "REVIEW_STATUS",
  "review_status",
  "DATE_TODAY",
  "date_today",
  "CLIENTSURNAME",
  "CLIENT SUR NAME",
  "insert_wording_here",
  "Insert_wording_here",
  "dd,mmm,yyyy",
  "jcp",
  "jca",
  "1*jcp",
  "1",
  "1p/30 m",
  "1p/30m*jca",
  "x*$1.17",
  "x*$63.00",
  "x*$67.00",
  "x*$140.00",
  "x*$160.00",
  "x*$190.00",
  "x*$430.00",
  "FORMAL_PROOF_PREP_QTY",
  "FORMAL_PROOF_PREP_UNIT",
  "FORMAL_PROOF_PREP_TOTAL",
  "FORMAL_PROOF_HEARING_QTY",
  "FORMAL_PROOF_HEARING_UNIT",
  "FORMAL_PROOF_HEARING_TOTAL",
  "FP_AGENT_QTY",
  "FP_AGENT_UNIT",
  "FP_AGENT_TOTAL",
  "AF_A_O",
  "INT_QTY",
  "INT_UNIT",
  "INT_TOTAL",
  "PH_MATTERS",
  "JC_PREP_QTY",
  "JC_PREP_UNIT",
  "JC_PREP_TOTAL",
  "JC_HEARING_QTY",
  "JC_HEARING_UNIT",
  "JC_HEARING_TOTAL",
  "JC_AGENT_QTY",
  "JC_AGENT_UNIT",
  "JC_AGENT_TOTAL",
  "AF_P_H",
  "JUDGE_DIRECTIONS",
  "DH_PREP_QTY",
  "DH_PREP_UNIT",
  "DH_PREP_TOTAL",
  "DH_HEAR_QTY",
  "DH_HEAR_UNIT",
  "DH_HEAR_TOTAL",
  "DH_AGENT_QTY",
  "DH_AGENT_UNIT",
  "DH_AGENT_TOTAL",
  "AF_D_H",
  "DPO",
  "PHM",
  "CJD",
  "CJD_QTY",
  "CJD_UNIT",
  "CJD_TOTAL",
  "AF_PHM",
  "IA_QTY",
  "IA_UNIT",
  "IA_TOTAL",
  "FPH_P_QTY",
  "FPH_P_UNIT",
  "FPH_P_TOTAL",
  "FPH_H_QTY",
  "FPH_H_UNIT",
  "FPH_H_TOTAL",
  "SC_P_QTY",
  "SC_P_UNIT",
  "SC_P_TOTAL",
  "SC_H_QTY",
  "SC_H_UNIT",
  "SC_H_TOTAL",
  "MOC_QTY",
  "MOC_UNIT",
  "MOC_TOTAL",
  "SR_QTY",
  "SR_UNIT",
  "SR_TOTAL",
  "DF_P_QTY",
  "DF_P_UNIT",
  "DF_P_TOTAL",
  "DF_H_QTY",
  "DF_H_UNIT",
  "DF_H_TOTAL",
  "DC_P_QTY",
  "DC_P_UNIT",
  "DC_P_TOTAL",
  "DC_H_QTY",
  "DC_H_UNIT",
  "DC_H_TOTAL",
  "PHC_P_QTY",
  "PHC_P_UNIT",
  "PHC_P_TOTAL",
  "PHC_H_QTY",
  "PHC_H_UNIT",
  "PHC_H_TOTAL",
  "mileage",
  "travel time",
  "travel_time",
  "tt_total",
  "ta",
  "ffp",
  "tffp",
  "td",
  "td-m",
  "tgst",
  "m_t",
  "total",
] as const;

export type ApprovedBillingPlaceholderKey = (typeof approvedBillingPlaceholderKeys)[number];

export type BillingMergeFields = Partial<Record<ApprovedBillingPlaceholderKey, MergeFieldTextValue>>;

export type BillingTemplateDefinition = {
  formType: BillingFormType;
  sourcePath: string;
  outputFileName: string;
};

export const billingTemplateDefinitions: Record<BillingFormType, BillingTemplateDefinition> = {
  "32B": {
    formType: "32B",
    sourcePath: billingTemplatePaths["32B"],
    outputFileName: "Completed Form32B.docx",
  },
  "33A": {
    formType: "33A",
    sourcePath: billingTemplatePaths["33A"],
    outputFileName: "Completed Form33A.docx",
  },
};

function formatMoney(value: number): string {
  return value ? value.toFixed(2) : "";
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatTotalMoney(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? String(value)
    : "";
}

function withSnakeCaseAliases(fields: BillingMergeFields): MergeFields {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => [
      [key, value],
      [key.toLowerCase(), value],
    ]),
  ) as MergeFields;
}

function getClientSurname(clientName: string): string {
  const parts = clientName.trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : "";
}

function buildProgressResultsWording(draft: BillingRecord["draft"]): string {
  return [
    draft.standardWording,
    draft.travel?.progressResultsWording,
    draft.parking > 0 ? "Parking" : "",
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((wording, index, wordings) => wordings.indexOf(wording) === index)
    .join("\n\n");
}

function calculateHalfHourUnits(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(1, Math.ceil(hours * 2));
}

function getSelectedAttendanceHours(record: BillingRecord, workItemId: string): number {
  return record.draft.structuredSelection?.workItems.find((item) => item.id === workItemId)?.attendanceHours
    ?? record.draft.attendanceHours;
}

function calculateForm33AAmounts(record: BillingRecord) {
  const draft = record.draft;
  const categories = draft.categories?.length ? draft.categories : [draft.category];
  const hasCategory = (category: BillingRecord["draft"]["category"]) => categories.includes(category);
  const isJudicialConference = hasCategory("judicial_conference") || hasCategory("pre_hearing_conference");
  const isFormalProof = hasCategory("formal_proof");
  const isInterlocutory = hasCategory("interlocutories");
  const isPreHearingMatters = hasCategory("pre_hearing_matters");
  const isJudgeDirections = hasCategory("complying_judges_directions");
  const isDefendedHearing = hasCategory("defended_hearing");
  const isDefendedProtectionOrder = hasCategory("defended_protection_order");
  const isAdditionalFactors = hasCategory("additional_factors");
  const isAgent = hasCategory("instructing_agent");
  const sourcePrompt = draft.sourcePrompt?.toLowerCase() ?? "";
  const agentHearingType = draft.structuredSelection?.agentHearingType;
  const additionalFactorSection = draft.structuredSelection?.additionalFactorSection;
  const isFormalProofAgent = isAgent && (agentHearingType === "formal_proof" || (!agentHearingType && sourcePrompt.includes("formal proof")));
  const isDefendedHearingAgent =
    isAgent &&
    !isFormalProofAgent &&
    (agentHearingType === "defended_hearing" || (!agentHearingType && (sourcePrompt.includes("defended") || sourcePrompt.includes("hearing"))));
  const isJudicialConferenceAgent = isAgent && !isFormalProofAgent && !isDefendedHearingAgent;
  const isAdditionalFactorsForDefended =
    isAdditionalFactors && (additionalFactorSection === "defended_hearing" || (!additionalFactorSection && (sourcePrompt.includes("defended") || sourcePrompt.includes("hearing"))));
  const isAdditionalFactorsForApplications =
    isAdditionalFactors &&
    (additionalFactorSection === "applications_orders" || (!additionalFactorSection && (sourcePrompt.includes("application") || sourcePrompt.includes("order"))));
  const isAdditionalFactorsForPreHearing =
    isAdditionalFactors && !isAdditionalFactorsForDefended && !isAdditionalFactorsForApplications;
  const judicialConferenceUnits = calculateHalfHourUnits(getSelectedAttendanceHours(record, "33-judicial-conference"));
  const formalProofUnits = calculateHalfHourUnits(getSelectedAttendanceHours(record, "33-formal-proof"));
  const defendedHearingSelectedUnits = calculateHalfHourUnits(getSelectedAttendanceHours(record, "33-defended-hearing"));
  const fixedFees = form33AFeeRules.fixedFees;
  const judicialConferencePreparation = isJudicialConference
    ? fixedFees.judicialConferencePreparation
    : 0;
  const judicialConferenceHearingUnits = isJudicialConference
    ? judicialConferenceUnits
    : 0;
  const judicialConferenceHearingRate = fixedFees.judicialConferenceHearingPerHalfHour;
  const judicialConferenceHearingTotal = judicialConferenceHearingUnits * judicialConferenceHearingRate;
  const formalProofPreparation = isFormalProof ? fixedFees.formalProofPreparation : 0;
  const formalProofHearingUnits = isFormalProof ? formalProofUnits : 0;
  const formalProofHearingTotal = formalProofHearingUnits * fixedFees.formalProofHearingPerHalfHour;
  const formalProofAgent = isFormalProofAgent ? fixedFees.formalProofAgent : 0;
  const applicationsOrdersAdditionalFactors = isAdditionalFactorsForApplications
    ? fixedFees.applicationsOrdersAdditionalFactors
    : 0;
  const interlocutories = isInterlocutory ? fixedFees.interlocutories : 0;
  const preHearingMatters = isPreHearingMatters ? fixedFees.preHearingMatters : 0;
  const judicialConferenceAgent = isJudicialConferenceAgent ? fixedFees.judicialConferenceAgent : 0;
  const preHearingAdditionalFactors = isAdditionalFactorsForPreHearing
    ? fixedFees.preHearingAdditionalFactors
    : 0;
  const judgeDirections = isJudgeDirections ? fixedFees.judgeDirections : 0;
  const defendedHearingPreparation = isDefendedHearing ? fixedFees.defendedHearingPreparation : 0;
  const defendedHearingUnits = isDefendedHearing ? defendedHearingSelectedUnits : 0;
  const defendedHearingTotal = defendedHearingUnits * fixedFees.defendedHearingPerHalfHour;
  const defendedHearingAgent = isDefendedHearingAgent ? fixedFees.defendedHearingAgent : 0;
  const defendedHearingAdditionalFactors = isAdditionalFactorsForDefended
    ? fixedFees.defendedHearingAdditionalFactors
    : 0;
  const defendedProtectionOrder = isDefendedProtectionOrder ? fixedFees.defendedProtectionOrder : 0;
  const totalApplication =
    judicialConferencePreparation +
    judicialConferenceHearingTotal +
    formalProofPreparation +
    formalProofHearingTotal +
    formalProofAgent +
    applicationsOrdersAdditionalFactors +
    interlocutories +
    preHearingMatters +
    judicialConferenceAgent +
    preHearingAdditionalFactors +
    judgeDirections +
    defendedHearingPreparation +
    defendedHearingTotal +
    defendedHearingAgent +
    defendedHearingAdditionalFactors +
    defendedProtectionOrder;
  const travelTimeAmount = (draft.travel?.travelTimeValue ?? 0) *
    form33AFeeRules.fixedFeePlusActivities.travelTimeHourlyRate;
  const totalFixedFeePlusActivities = 0;
  const totalDisbursementsExcludingMileage = draft.parking + draft.officeDisbursements + travelTimeAmount;
  const totalGst = roundMoney(
    (totalApplication + totalFixedFeePlusActivities + totalDisbursementsExcludingMileage) *
    form33AFeeRules.gstRate,
  );
  const totalMileage = roundMoney((draft.travel?.mileageValue ?? 0) * form33AFeeRules.mileageRatePerKm);
  const total = roundMoney(
    totalApplication +
    totalFixedFeePlusActivities +
    totalDisbursementsExcludingMileage +
    totalGst +
    totalMileage,
  );

  return {
    judicialConferencePreparation,
    judicialConferenceHearingRate,
    judicialConferenceHearingUnits,
    judicialConferenceHearingTotal,
    formalProofPreparation,
    formalProofHearingUnits,
    formalProofHearingTotal,
    formalProofAgent,
    applicationsOrdersAdditionalFactors,
    interlocutories,
    preHearingMatters,
    judicialConferenceAgent,
    preHearingAdditionalFactors,
    judgeDirections,
    defendedHearingPreparation,
    defendedHearingUnits,
    defendedHearingTotal,
    defendedHearingAgent,
    defendedHearingAdditionalFactors,
    defendedProtectionOrder,
    travelTimeAmount,
    totalApplication,
    totalFixedFeePlusActivities,
    totalDisbursementsExcludingMileage,
    totalGst,
    totalMileage,
    total,
  };
}

function calculateForm32BAmounts(record: BillingRecord) {
  const draft = record.draft;
  const sourcePrompt = draft.sourcePrompt.toLowerCase();
  const fixedFees = form32BFeeRules.fixedFees;
  const categories = draft.categories?.length ? draft.categories : [draft.category];
  const hasCategory = (category: BillingRecord["draft"]["category"]) => categories.includes(category);
  const isPreHearingMatters = hasCategory("pre_hearing_matters");
  const isComplyingJudgesDirections = hasCategory("complying_judges_directions");
  const isAgent = hasCategory("instructing_agent");
  const isFormalProof = hasCategory("formal_proof");
  const isSettlementConference = hasCategory("settlement_conference");
  const isMemorandumOfConsent = hasCategory("consent_memorandum");
  const isReport = hasCategory("lawyer_for_child_report");
  const isAdditionalFactors = hasCategory("additional_factors");
  const isDefendedHearing = hasCategory("defended_hearing");
  const isDirectionsConference = hasCategory("directions_conference");
  const isPreHearingConference = hasCategory("pre_hearing_conference");
  const preHearingMatters = isPreHearingMatters ? fixedFees.preHearingMatters : 0;
  const complyingJudgesDirections = isComplyingJudgesDirections
    ? fixedFees.complyingJudgesDirections
    : 0;
  const instructingAgent = isAgent ? fixedFees.instructingAgent : 0;
  const formalProofPreparation = isFormalProof ? fixedFees.formalProofPreparation : 0;
  const formalProofHearingUnits = isFormalProof
    ? calculateHalfHourUnits(getSelectedAttendanceHours(record, "32-formal-proof"))
    : 0;
  const formalProofHearingTotal = formalProofHearingUnits * fixedFees.formalProofHearingPerHalfHour;
  const settlementConferencePreparation = isSettlementConference
    ? fixedFees.settlementConferencePreparation
    : 0;
  const settlementConferenceHearingUnits = isSettlementConference
    ? calculateHalfHourUnits(getSelectedAttendanceHours(record, "32-settlement-conference"))
    : 0;
  const settlementConferenceHearingTotal =
    settlementConferenceHearingUnits * fixedFees.settlementConferenceHearingPerHalfHour;
  const memorandumOfConsent = isMemorandumOfConsent ? fixedFees.memorandumOfConsent : 0;
  const report = isReport ? fixedFees.report : 0;
  const additionalFactorsPreHearingMatters = isAdditionalFactors
    ? fixedFees.additionalFactorsPreHearingMatters
    : 0;
  const defendedHearingPreparation = isDefendedHearing ? fixedFees.defendedHearingPreparation : 0;
  const defendedHearingUnits = isDefendedHearing
    ? calculateHalfHourUnits(getSelectedAttendanceHours(record, "32-defended-hearing"))
    : 0;
  const defendedHearingTotal = defendedHearingUnits * fixedFees.defendedHearingPerHalfHour;
  const directionsConferencePreparation = isDirectionsConference
    ? fixedFees.directionsConferencePreparation
    : 0;
  const directionsConferenceHearingUnits = isDirectionsConference
    ? calculateHalfHourUnits(getSelectedAttendanceHours(record, "32-directions-conference"))
    : 0;
  const directionsConferenceHearingTotal =
    directionsConferenceHearingUnits * fixedFees.directionsConferenceHearingPerHalfHour;
  const preHearingConferencePreparation = isPreHearingConference
    ? fixedFees.preHearingConferencePreparation
    : 0;
  const preHearingConferenceHearingUnits = isPreHearingConference
    ? calculateHalfHourUnits(getSelectedAttendanceHours(record, "32-pre-hearing-conference"))
    : 0;
  const preHearingConferenceHearingTotal =
    preHearingConferenceHearingUnits * fixedFees.preHearingConferenceHearingPerHalfHour;
  const travelTimeAmount = (draft.travel?.travelTimeValue ?? 0) *
    form32BFeeRules.disbursements.travelTimeHourlyRate;
  const totalApplication =
    preHearingMatters +
    complyingJudgesDirections +
    instructingAgent +
    formalProofPreparation +
    formalProofHearingTotal +
    settlementConferencePreparation +
    settlementConferenceHearingTotal +
    memorandumOfConsent +
    report +
    additionalFactorsPreHearingMatters +
    defendedHearingPreparation +
    defendedHearingTotal +
    directionsConferencePreparation +
    directionsConferenceHearingTotal +
    preHearingConferencePreparation +
    preHearingConferenceHearingTotal;
  const totalFixedFeePlusActivities = 0;
  const totalDisbursementsExcludingMileage = draft.parking + draft.officeDisbursements + travelTimeAmount;
  const totalGst = roundMoney(
    (totalApplication + totalFixedFeePlusActivities + totalDisbursementsExcludingMileage) *
    form32BFeeRules.gstRate,
  );
  const totalMileage = roundMoney((draft.travel?.mileageValue ?? 0) * form32BFeeRules.mileageRatePerKm);
  const total = roundMoney(
    totalApplication +
    totalFixedFeePlusActivities +
    totalDisbursementsExcludingMileage +
    totalGst +
    totalMileage,
  );

  return {
    sourcePrompt,
    preHearingMatters,
    complyingJudgesDirections,
    instructingAgent,
    formalProofPreparation,
    formalProofHearingUnits,
    formalProofHearingTotal,
    settlementConferencePreparation,
    settlementConferenceHearingUnits,
    settlementConferenceHearingTotal,
    memorandumOfConsent,
    report,
    additionalFactorsPreHearingMatters,
    defendedHearingPreparation,
    defendedHearingUnits,
    defendedHearingTotal,
    directionsConferencePreparation,
    directionsConferenceHearingUnits,
    directionsConferenceHearingTotal,
    preHearingConferencePreparation,
    preHearingConferenceHearingUnits,
    preHearingConferenceHearingTotal,
    travelTimeAmount,
    totalApplication,
    totalFixedFeePlusActivities,
    totalDisbursementsExcludingMileage,
    totalGst,
    totalMileage,
    total,
  };
}

export type BillingTotals = {
  totalApplication: number;
  totalFixedFeePlusActivities: number;
  totalDisbursementsExcludingMileage: number;
  totalGst: number;
  totalMileage: number;
  total: number;
};

export function calculateBillingTotals(record: BillingRecord): BillingTotals {
  const amounts = record.formType === "32B"
    ? calculateForm32BAmounts(record)
    : calculateForm33AAmounts(record);

  return {
    totalApplication: amounts.totalApplication,
    totalFixedFeePlusActivities: amounts.totalFixedFeePlusActivities,
    totalDisbursementsExcludingMileage: amounts.totalDisbursementsExcludingMileage,
    totalGst: amounts.totalGst,
    totalMileage: amounts.totalMileage,
    total: amounts.total,
  };
}

function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function buildBillingMergeFields(record: BillingRecord): MergeFields {
  const draft = record.draft;
  const form33AAmounts = calculateForm33AAmounts(record);
  const form32BAmounts = calculateForm32BAmounts(record);
  const attendanceTime = draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime}` : "";
  const progressResultsWording = buildProgressResultsWording(draft);
  const totalDisbursements = draft.parking + draft.officeDisbursements;
  const evidenceStatus = record.evidence.length
    ? record.evidence
        .map((requirement) => `${requirement.label}: ${requirement.uploaded ? "received" : "pending"}`)
        .join("; ")
    : "No evidence required";
  const fields: BillingMergeFields = {
    BILLING_RECORD_ID: record.id,
    MATTER_ID: record.matterId,
    CLIENT_NAME: draft.clientName.toLocaleUpperCase("en-NZ"),
    LEGAL_AID_NUMBER: draft.legalAidNumber,
    INVOICE_NUMBER: draft.invoiceNumber,
    MATTER_DETAILS: draft.matterDetails,
    PROCEEDING_TYPE: draft.proceedingType,
    FORM_TYPE: draft.formType,
    CATEGORY_LABEL: draft.categoryLabel,
    COURT: draft.court.toLocaleUpperCase("en-NZ"),
    BILLING_DATE: draft.date,
    START_TIME: draft.startTime,
    END_TIME: draft.endTime,
    ATTENDANCE_TIME: attendanceTime,
    ATTENDANCE_HOURS: formatNumber(draft.attendanceHours),
    TRAVEL_RETURN_KM: formatNumber(draft.travel?.returnKm),
    TRAVEL_RETURN_HOURS: formatNumber(draft.travel?.returnTravelHours),
    TRAVEL_TIME_BILLING_ROW: draft.travel?.travelTimeBillingRow ?? "",
    TRAVEL_TIME_VALUE: formatNumber(draft.travel?.travelTimeValue),
    RETURN_TRAVEL_TIME: draft.travel?.returnTravelTime ?? "",
    MILEAGE_BILLING_ROW: draft.travel?.mileageBillingRow ?? "",
    MILEAGE_VALUE: formatNumber(draft.travel?.mileageValue),
    RETURN_DISTANCE: draft.travel?.returnDistance ?? "",
    TRAVEL_PROGRESS_WORDING: draft.travel?.progressResultsWording ?? "",
    PARKING: formatMoney(draft.parking),
    OFFICE_DISBURSEMENTS: formatMoney(draft.officeDisbursements),
    od: formatMoney(draft.officeDisbursements),
    TOTAL_DISBURSEMENTS: formatMoney(totalDisbursements),
    STANDARD_WORDING: progressResultsWording,
    EVIDENCE_STATUS: evidenceStatus,
    TEMPLATE_PATH: record.templatePath,
    REVIEW_STATUS: record.status === "pending_evidence" ? "Pending evidence" : "Ready to review",
    DATE_TODAY: draft.date,
    "dd,mmm,yyyy": formatDisplayDate(draft.date),
    CLIENTSURNAME: getClientSurname(draft.clientName),
    "CLIENT SUR NAME": getClientSurname(draft.clientName),
    insert_wording_here: progressResultsWording,
    Insert_wording_here: progressResultsWording,
    jcp: formatMoney(form33AAmounts.judicialConferencePreparation),
    jca: formatMoney(form33AAmounts.judicialConferenceHearingRate),
    "1*jcp": formatMoney(form33AAmounts.judicialConferencePreparation),
    "1": form33AAmounts.judicialConferencePreparation ? "1" : "",
    "1p/30 m": formatNumber(form33AAmounts.judicialConferenceHearingUnits),
    "1p/30m*jca": formatMoney(form33AAmounts.judicialConferenceHearingTotal),
    FORMAL_PROOF_PREP_QTY: form33AAmounts.formalProofPreparation ? "1" : "",
    FORMAL_PROOF_PREP_UNIT: form33AAmounts.formalProofPreparation
      ? formatMoney(form33AFeeRules.fixedFees.formalProofPreparation)
      : "",
    FORMAL_PROOF_PREP_TOTAL: formatMoney(form33AAmounts.formalProofPreparation),
    FORMAL_PROOF_HEARING_QTY: formatNumber(form33AAmounts.formalProofHearingUnits),
    FORMAL_PROOF_HEARING_UNIT: form33AAmounts.formalProofHearingUnits
      ? formatMoney(form33AFeeRules.fixedFees.formalProofHearingPerHalfHour)
      : "",
    FORMAL_PROOF_HEARING_TOTAL: formatMoney(form33AAmounts.formalProofHearingTotal),
    FP_AGENT_QTY: form33AAmounts.formalProofAgent ? "1" : "",
    FP_AGENT_UNIT: form33AAmounts.formalProofAgent
      ? formatMoney(form33AFeeRules.fixedFees.formalProofAgent)
      : "",
    FP_AGENT_TOTAL: formatMoney(form33AAmounts.formalProofAgent),
    AF_A_O: formatMoney(form33AAmounts.applicationsOrdersAdditionalFactors),
    INT_QTY: form33AAmounts.interlocutories ? "1" : "",
    INT_UNIT: form33AAmounts.interlocutories
      ? formatMoney(form33AFeeRules.fixedFees.interlocutories)
      : "",
    INT_TOTAL: formatMoney(form33AAmounts.interlocutories),
    PH_MATTERS: formatMoney(form33AAmounts.preHearingMatters),
    JC_PREP_QTY: form33AAmounts.judicialConferencePreparation ? "1" : "",
    JC_PREP_UNIT: form33AAmounts.judicialConferencePreparation
      ? formatMoney(form33AFeeRules.fixedFees.judicialConferencePreparation)
      : "",
    JC_PREP_TOTAL: formatMoney(form33AAmounts.judicialConferencePreparation),
    JC_HEARING_QTY: formatNumber(form33AAmounts.judicialConferenceHearingUnits),
    JC_HEARING_UNIT: form33AAmounts.judicialConferenceHearingUnits
      ? formatMoney(form33AFeeRules.fixedFees.judicialConferenceHearingPerHalfHour)
      : "",
    JC_HEARING_TOTAL: formatMoney(form33AAmounts.judicialConferenceHearingTotal),
    JC_AGENT_QTY: form33AAmounts.judicialConferenceAgent ? "1" : "",
    JC_AGENT_UNIT: form33AAmounts.judicialConferenceAgent
      ? formatMoney(form33AFeeRules.fixedFees.judicialConferenceAgent)
      : "",
    JC_AGENT_TOTAL: formatMoney(form33AAmounts.judicialConferenceAgent),
    AF_P_H: formatMoney(form33AAmounts.preHearingAdditionalFactors),
    JUDGE_DIRECTIONS: formatMoney(form33AAmounts.judgeDirections),
    DH_PREP_QTY: form33AAmounts.defendedHearingPreparation ? "1" : "",
    DH_PREP_UNIT: form33AAmounts.defendedHearingPreparation
      ? formatMoney(form33AFeeRules.fixedFees.defendedHearingPreparation)
      : "",
    DH_PREP_TOTAL: formatMoney(form33AAmounts.defendedHearingPreparation),
    DH_HEAR_QTY: formatNumber(form33AAmounts.defendedHearingUnits),
    DH_HEAR_UNIT: form33AAmounts.defendedHearingUnits
      ? formatMoney(form33AFeeRules.fixedFees.defendedHearingPerHalfHour)
      : "",
    DH_HEAR_TOTAL: formatMoney(form33AAmounts.defendedHearingTotal),
    DH_AGENT_QTY: form33AAmounts.defendedHearingAgent ? "1" : "",
    DH_AGENT_UNIT: form33AAmounts.defendedHearingAgent
      ? formatMoney(form33AFeeRules.fixedFees.defendedHearingAgent)
      : "",
    DH_AGENT_TOTAL: formatMoney(form33AAmounts.defendedHearingAgent),
    AF_D_H: formatMoney(form33AAmounts.defendedHearingAdditionalFactors),
    DPO: formatMoney(form33AAmounts.defendedProtectionOrder),
    PHM: formatMoney(form32BAmounts.preHearingMatters),
    CJD: formatMoney(form32BAmounts.complyingJudgesDirections),
    // This template row has a narrow third placeholder that is not a usable
    // amount box. Put $190 in the two normal boxes and leave that cell empty.
    CJD_QTY: form32BAmounts.complyingJudgesDirections
      ? formatMoney(form32BFeeRules.fixedFees.complyingJudgesDirections)
      : "",
    CJD_UNIT: formatMoney(form32BAmounts.complyingJudgesDirections),
    CJD_TOTAL: "",
    AF_PHM: formatMoney(form32BAmounts.additionalFactorsPreHearingMatters),
    IA_QTY: form32BAmounts.instructingAgent ? "1" : "",
    IA_UNIT: form32BAmounts.instructingAgent
      ? formatMoney(form32BFeeRules.fixedFees.instructingAgent)
      : "",
    IA_TOTAL: formatMoney(form32BAmounts.instructingAgent),
    FPH_P_QTY: form32BAmounts.formalProofPreparation ? "1" : "",
    FPH_P_UNIT: form32BAmounts.formalProofPreparation
      ? formatMoney(form32BFeeRules.fixedFees.formalProofPreparation)
      : "",
    FPH_P_TOTAL: formatMoney(form32BAmounts.formalProofPreparation),
    FPH_H_QTY: formatNumber(form32BAmounts.formalProofHearingUnits),
    FPH_H_UNIT: form32BAmounts.formalProofHearingUnits
      ? formatMoney(form32BFeeRules.fixedFees.formalProofHearingPerHalfHour)
      : "",
    FPH_H_TOTAL: formatMoney(form32BAmounts.formalProofHearingTotal),
    SC_P_QTY: form32BAmounts.settlementConferencePreparation ? "1" : "",
    SC_P_UNIT: form32BAmounts.settlementConferencePreparation
      ? formatMoney(form32BFeeRules.fixedFees.settlementConferencePreparation)
      : "",
    SC_P_TOTAL: formatMoney(form32BAmounts.settlementConferencePreparation),
    SC_H_QTY: formatNumber(form32BAmounts.settlementConferenceHearingUnits),
    SC_H_UNIT: form32BAmounts.settlementConferenceHearingUnits
      ? formatMoney(form32BFeeRules.fixedFees.settlementConferenceHearingPerHalfHour)
      : "",
    SC_H_TOTAL: formatMoney(form32BAmounts.settlementConferenceHearingTotal),
    MOC_QTY: form32BAmounts.memorandumOfConsent ? "1" : "",
    MOC_UNIT: form32BAmounts.memorandumOfConsent
      ? formatMoney(form32BFeeRules.fixedFees.memorandumOfConsent)
      : "",
    MOC_TOTAL: formatMoney(form32BAmounts.memorandumOfConsent),
    SR_QTY: form32BAmounts.report ? "1" : "",
    SR_UNIT: form32BAmounts.report
      ? formatMoney(form32BFeeRules.fixedFees.report)
      : "",
    SR_TOTAL: formatMoney(form32BAmounts.report),
    DF_P_QTY: form32BAmounts.defendedHearingPreparation ? "1" : "",
    DF_P_UNIT: form32BAmounts.defendedHearingPreparation
      ? formatMoney(form32BFeeRules.fixedFees.defendedHearingPreparation)
      : "",
    DF_P_TOTAL: formatMoney(form32BAmounts.defendedHearingPreparation),
    DF_H_QTY: formatNumber(form32BAmounts.defendedHearingUnits),
    DF_H_UNIT: form32BAmounts.defendedHearingUnits
      ? formatMoney(form32BFeeRules.fixedFees.defendedHearingPerHalfHour)
      : "",
    DF_H_TOTAL: formatMoney(form32BAmounts.defendedHearingTotal),
    DC_P_QTY: form32BAmounts.directionsConferencePreparation ? "1" : "",
    DC_P_UNIT: form32BAmounts.directionsConferencePreparation
      ? formatMoney(form32BFeeRules.fixedFees.directionsConferencePreparation)
      : "",
    DC_P_TOTAL: formatMoney(form32BAmounts.directionsConferencePreparation),
    DC_H_QTY: formatNumber(form32BAmounts.directionsConferenceHearingUnits),
    DC_H_UNIT: form32BAmounts.directionsConferenceHearingUnits
      ? formatMoney(form32BFeeRules.fixedFees.directionsConferenceHearingPerHalfHour)
      : "",
    DC_H_TOTAL: formatMoney(form32BAmounts.directionsConferenceHearingTotal),
    PHC_P_QTY: form32BAmounts.preHearingConferencePreparation ? "1" : "",
    PHC_P_UNIT: form32BAmounts.preHearingConferencePreparation
      ? formatMoney(form32BFeeRules.fixedFees.preHearingConferencePreparation)
      : "",
    PHC_P_TOTAL: formatMoney(form32BAmounts.preHearingConferencePreparation),
    PHC_H_QTY: formatNumber(form32BAmounts.preHearingConferenceHearingUnits),
    PHC_H_UNIT: form32BAmounts.preHearingConferenceHearingUnits
      ? formatMoney(form32BFeeRules.fixedFees.preHearingConferenceHearingPerHalfHour)
      : "",
    PHC_H_TOTAL: formatMoney(form32BAmounts.preHearingConferenceHearingTotal),
    mileage: formatNumber(draft.travel?.mileageValue),
    "travel time": formatNumber(draft.travel?.travelTimeValue),
    travel_time: formatNumber(draft.travel?.travelTimeValue),
    tt_total: formatMoney(record.formType === "32B" ? form32BAmounts.travelTimeAmount : form33AAmounts.travelTimeAmount),
    "x*$1.17": formatMoney(record.formType === "32B" ? form32BAmounts.totalMileage : form33AAmounts.totalMileage),
    "x*$63.00": formatMoney(record.formType === "32B" ? form32BAmounts.travelTimeAmount : form33AAmounts.travelTimeAmount),
    "x*$67.00": [
      "",
      formatMoney(form33AAmounts.judicialConferenceHearingTotal),
      "",
    ],
    "x*$140.00": [
      "",
      "",
      formatMoney(form33AAmounts.judicialConferencePreparation),
    ],
    "x*$160.00": "",
    "x*$190.00": ["", "", ""],
    "x*$430.00": "",
    ta: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalApplication : form33AAmounts.totalApplication),
    ffp: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalFixedFeePlusActivities : form33AAmounts.totalFixedFeePlusActivities),
    tffp: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalFixedFeePlusActivities : form33AAmounts.totalFixedFeePlusActivities),
    td: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalDisbursementsExcludingMileage : form33AAmounts.totalDisbursementsExcludingMileage),
    "td-m": formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalDisbursementsExcludingMileage : form33AAmounts.totalDisbursementsExcludingMileage),
    tgst: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalGst : form33AAmounts.totalGst),
    m_t: formatTotalMoney(record.formType === "32B" ? form32BAmounts.totalMileage : form33AAmounts.totalMileage),
    total: formatTotalMoney(record.formType === "32B" ? form32BAmounts.total : form33AAmounts.total),
  };

  return withSnakeCaseAliases(fields);
}
