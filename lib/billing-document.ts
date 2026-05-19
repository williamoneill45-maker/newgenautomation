import type { MergeFields, MergeFieldTextValue } from "./document-automation";
import {
  billingTemplatePaths,
  type BillingFormType,
  type BillingRecord,
} from "./billing-automation";

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
  "mileage",
  "mileage_total",
  "travel time",
  "travel_time",
  "tt_total",
  "ta",
  "tffp",
  "td",
  "td-m",
  "tgst",
  "m",
  "tm",
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

export const form33AFeeRules = {
  gstRate: 0.15,
  mileageRatePerKm: 1.17,
  fixedFees: {
    formalProofPreparation: 140,
    formalProofHearingPerHalfHour: 67,
    formalProofAgent: 190,
    applicationsOrdersAdditionalFactors: 190,
    interlocutories: 140,
    preHearingMatters: 620,
    judicialConferencePreparation: 140,
    judicialConferenceHearingPerHalfHour: 67,
    judicialConferenceAgent: 190,
    preHearingAdditionalFactors: 190,
    judgeDirections: 190,
    defendedHearingPreparation: 160,
    defendedHearingPerHalfHour: 67,
    defendedHearingAgent: 190,
    defendedHearingAdditionalFactors: 190,
    defendedProtectionOrder: 430,
  },
  judicialConference: {
    preparationFee: 140,
    hearingFeePerHalfHour: 67,
  },
  fixedFeePlusActivities: {
    travelTimeHourlyRate: 63,
  },
} as const;

function formatMoney(value: number): string {
  return value ? value.toFixed(2) : "";
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

function calculateHalfHourUnits(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.max(1, Math.ceil(hours * 2));
}

function calculateForm33AAmounts(record: BillingRecord) {
  const draft = record.draft;
  const isJudicialConference = draft.category === "judicial_conference" || draft.category === "pre_hearing_conference";
  const isFormalProof = draft.category === "formal_proof";
  const isInterlocutory = draft.category === "interlocutories";
  const isPreHearingMatters = draft.category === "pre_hearing_matters";
  const isJudgeDirections = draft.category === "complying_judges_directions";
  const isDefendedHearing = draft.category === "defended_hearing";
  const isDefendedProtectionOrder = draft.category === "defended_protection_order";
  const isAdditionalFactors = draft.category === "additional_factors";
  const isAgent = draft.category === "instructing_agent";
  const sourcePrompt = draft.sourcePrompt?.toLowerCase() ?? "";
  const isFormalProofAgent = isAgent && sourcePrompt.includes("formal proof");
  const isDefendedHearingAgent =
    isAgent &&
    !isFormalProofAgent &&
    (sourcePrompt.includes("defended") || sourcePrompt.includes("hearing"));
  const isJudicialConferenceAgent = isAgent && !isFormalProofAgent && !isDefendedHearingAgent;
  const isAdditionalFactorsForDefended =
    isAdditionalFactors && (sourcePrompt.includes("defended") || sourcePrompt.includes("hearing"));
  const isAdditionalFactorsForApplications =
    isAdditionalFactors &&
    (sourcePrompt.includes("application") || sourcePrompt.includes("order"));
  const isAdditionalFactorsForPreHearing =
    isAdditionalFactors && !isAdditionalFactorsForDefended && !isAdditionalFactorsForApplications;
  const halfHourUnits = calculateHalfHourUnits(draft.attendanceHours);
  const fixedFees = form33AFeeRules.fixedFees;
  const judicialConferencePreparation = isJudicialConference
    ? fixedFees.judicialConferencePreparation
    : 0;
  const judicialConferenceHearingUnits = isJudicialConference
    ? halfHourUnits
    : 0;
  const judicialConferenceHearingRate = fixedFees.judicialConferenceHearingPerHalfHour;
  const judicialConferenceHearingTotal = judicialConferenceHearingUnits * judicialConferenceHearingRate;
  const formalProofPreparation = isFormalProof ? fixedFees.formalProofPreparation : 0;
  const formalProofHearingUnits = isFormalProof ? halfHourUnits : 0;
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
  const defendedHearingUnits = isDefendedHearing ? halfHourUnits : 0;
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
  const totalFixedFeePlusActivities = travelTimeAmount;
  const totalDisbursementsExcludingMileage = draft.parking + draft.officeDisbursements;
  const totalGst =
    (totalApplication + totalFixedFeePlusActivities + totalDisbursementsExcludingMileage) *
    form33AFeeRules.gstRate;
  const totalMileage = (draft.travel?.mileageValue ?? 0) * form33AFeeRules.mileageRatePerKm;
  const total =
    totalApplication +
    totalFixedFeePlusActivities +
    totalDisbursementsExcludingMileage +
    totalGst +
    totalMileage;

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
  const attendanceTime = draft.startTime && draft.endTime ? `${draft.startTime}-${draft.endTime}` : "";
  const totalDisbursements = draft.parking + draft.officeDisbursements;
  const evidenceStatus = record.evidence.length
    ? record.evidence
        .map((requirement) => `${requirement.label}: ${requirement.uploaded ? "received" : "pending"}`)
        .join("; ")
    : "No evidence required";
  const fields: BillingMergeFields = {
    BILLING_RECORD_ID: record.id,
    MATTER_ID: record.matterId,
    CLIENT_NAME: draft.clientName,
    LEGAL_AID_NUMBER: draft.legalAidNumber,
    INVOICE_NUMBER: draft.invoiceNumber,
    MATTER_DETAILS: draft.matterDetails,
    PROCEEDING_TYPE: draft.proceedingType,
    FORM_TYPE: draft.formType,
    CATEGORY_LABEL: draft.categoryLabel,
    COURT: draft.court,
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
    TOTAL_DISBURSEMENTS: formatMoney(totalDisbursements),
    STANDARD_WORDING: draft.standardWording,
    EVIDENCE_STATUS: evidenceStatus,
    TEMPLATE_PATH: record.templatePath,
    REVIEW_STATUS: record.status === "pending_evidence" ? "Pending evidence" : "Ready to review",
    DATE_TODAY: draft.date,
    "dd,mmm,yyyy": formatDisplayDate(draft.date),
    CLIENTSURNAME: getClientSurname(draft.clientName),
    "CLIENT SUR NAME": getClientSurname(draft.clientName),
    insert_wording_here: draft.standardWording,
    Insert_wording_here: draft.standardWording,
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
    mileage: formatNumber(draft.travel?.mileageValue),
    mileage_total: formatMoney(form33AAmounts.totalMileage),
    "travel time": formatNumber(draft.travel?.travelTimeValue),
    travel_time: formatNumber(draft.travel?.travelTimeValue),
    tt_total: formatMoney(form33AAmounts.travelTimeAmount),
    "x*$1.17": formatMoney(form33AAmounts.totalMileage),
    "x*$63.00": formatMoney(form33AAmounts.travelTimeAmount),
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
    ta: formatMoney(form33AAmounts.totalApplication),
    tffp: formatMoney(form33AAmounts.totalFixedFeePlusActivities),
    td: formatMoney(form33AAmounts.totalDisbursementsExcludingMileage),
    "td-m": formatMoney(form33AAmounts.totalDisbursementsExcludingMileage),
    tgst: formatMoney(form33AAmounts.totalGst),
    m: formatMoney(form33AAmounts.totalMileage),
    tm: formatMoney(form33AAmounts.totalMileage),
    total: formatMoney(form33AAmounts.total),
  };

  return withSnakeCaseAliases(fields);
}
