import type { MergeFields } from "./document-automation";
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
  "insert_wording_here",
  "jcp",
  "jca",
  "1*jcp",
  "1",
  "1p/30 m",
  "1p/30m*jca",
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

export type BillingMergeFields = Partial<Record<ApprovedBillingPlaceholderKey, string>>;

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
  judicialConference: {
    preparationFee: 140,
    hearingFeePerHalfHour: 67,
  },
  fixedFeePlusActivities: {
    travelTimeHourlyRate: 0,
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
  const isJudicialConference = draft.category === "judicial_conference";
  const judicialConferencePreparation = isJudicialConference
    ? form33AFeeRules.judicialConference.preparationFee
    : 0;
  const judicialConferenceHearingUnits = isJudicialConference
    ? calculateHalfHourUnits(draft.attendanceHours)
    : 0;
  const judicialConferenceHearingRate = form33AFeeRules.judicialConference.hearingFeePerHalfHour;
  const judicialConferenceHearingTotal = judicialConferenceHearingUnits * judicialConferenceHearingRate;
  const totalApplication = judicialConferencePreparation + judicialConferenceHearingTotal;
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
    totalApplication,
    totalFixedFeePlusActivities,
    totalDisbursementsExcludingMileage,
    totalGst,
    totalMileage,
    total,
  };
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
    CLIENTSURNAME: getClientSurname(draft.clientName),
    insert_wording_here: draft.standardWording,
    jcp: formatMoney(form33AAmounts.judicialConferencePreparation),
    jca: formatMoney(form33AAmounts.judicialConferenceHearingRate),
    "1*jcp": formatMoney(form33AAmounts.judicialConferencePreparation),
    "1": form33AAmounts.judicialConferencePreparation ? "1" : "",
    "1p/30 m": formatNumber(form33AAmounts.judicialConferenceHearingUnits),
    "1p/30m*jca": formatMoney(form33AAmounts.judicialConferenceHearingTotal),
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
