export type BillingFormType = "32B" | "33A";

export type BillingStatus = "ready_to_review" | "pending_evidence";

export type BillingCategory =
  | "pre_hearing_conference"
  | "judicial_conference"
  | "directions_conference"
  | "settlement_conference"
  | "lawyer_for_child_report"
  | "defended_hearing"
  | "consent_memorandum"
  | "complying_judges_directions"
  | "general_billing_entry";

export type BillingMatterInput = {
  matterId?: string;
  clientName?: string;
  legalAidNumber?: string;
  invoiceNumber?: string;
  matterDetails?: string;
  proceedingType?: string;
};

export type BillingDraftInput = {
  prompt: string;
  formType?: BillingFormType;
  matter?: BillingMatterInput;
  uploadedEvidence?: string[];
};

export type TravelReference = {
  code: "MANUKAU_COURT" | "AUCKLAND_COURT" | "NORTH_SHORE_COURT" | "WAITAKERE_COURT";
  court: string;
  travelTimeBillingRow: string;
  travelTimeValue: number;
  returnTravelTime: string;
  mileageBillingRow: string;
  mileageValue: number;
  returnDistance: string;
  returnKm: number;
  returnTravelHours: number;
  progressResultsWording: string;
};

export type EvidenceRequirement = {
  type: string;
  label: string;
  uploaded: boolean;
};

export type BillingDraft = {
  matterId: string;
  clientName: string;
  legalAidNumber: string;
  invoiceNumber: string;
  matterDetails: string;
  proceedingType: string;
  formType: BillingFormType;
  category: BillingCategory;
  categoryLabel: string;
  court: string;
  date: string;
  startTime: string;
  endTime: string;
  attendanceHours: number;
  travel?: TravelReference;
  parking: number;
  officeDisbursements: number;
  standardWording: string;
  evidenceRequirements: EvidenceRequirement[];
  status: BillingStatus;
  templateStatus: string;
  warnings: string[];
};

export type BillingRecord = {
  id: string;
  matterId: string;
  clientName: string;
  legalAidNumber: string;
  invoiceNumber: string;
  formType: BillingFormType;
  status: BillingStatus;
  draft: BillingDraft;
  evidence: EvidenceRequirement[];
  evidenceStoragePaths: string[];
  templatePath: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingRecordRow = {
  id: string;
  matter_id: string;
  client_name: string;
  legal_aid_number: string;
  invoice_number: string;
  form_type: BillingFormType;
  status: BillingStatus;
  draft_json: BillingDraft;
  evidence_json: EvidenceRequirement[];
  evidence_storage_paths: string[];
  template_path: string;
  created_at: string;
  updated_at: string;
};

export const billingTemplatePaths: Record<BillingFormType, string> = {
  "32B": "templates/billing/Form32B.dotx",
  "33A": "templates/billing/Form 33a Test Template.docx",
};

const CATEGORY_LABELS: Record<BillingCategory, string> = {
  pre_hearing_conference: "Pre-hearing conference",
  judicial_conference: "Judicial conference",
  directions_conference: "Directions conference",
  settlement_conference: "Settlement conference",
  lawyer_for_child_report: "Lawyer for Child report",
  defended_hearing: "Defended hearing",
  consent_memorandum: "Consent memorandum",
  complying_judges_directions: "Complying with Judge's directions",
  general_billing_entry: "General billing entry",
};

export const travelReferences: TravelReference[] = [
  {
    code: "MANUKAU_COURT",
    court: "Manukau Court",
    travelTimeBillingRow: "Travel – Time – necessary",
    travelTimeValue: 1,
    returnTravelTime: "1 hour",
    mileageBillingRow: "Travel – Personal car – necessary – @ $1.17 per km",
    mileageValue: 38,
    returnDistance: "38km",
    returnKm: 38,
    returnTravelHours: 1,
    progressResultsWording: "Travel time and mileage to Manukau Court return",
  },
  {
    code: "AUCKLAND_COURT",
    court: "Auckland Court",
    travelTimeBillingRow: "Travel – Time – necessary",
    travelTimeValue: 1,
    returnTravelTime: "1 hour",
    mileageBillingRow: "Travel – Personal car – necessary – @ $1.17 per km",
    mileageValue: 20,
    returnDistance: "20km",
    returnKm: 20,
    returnTravelHours: 1,
    progressResultsWording: "Travel time and mileage to Auckland Court return",
  },
  {
    code: "NORTH_SHORE_COURT",
    court: "North Shore Court",
    travelTimeBillingRow: "Travel – Time – necessary",
    travelTimeValue: 1.5,
    returnTravelTime: "1.5 hours",
    mileageBillingRow: "Travel – Personal car – necessary – @ $1.17 per km",
    mileageValue: 57.2,
    returnDistance: "57.2km",
    returnKm: 57.2,
    returnTravelHours: 1.5,
    progressResultsWording: "Travel time and mileage to North Shore Court return",
  },
  {
    code: "WAITAKERE_COURT",
    court: "Waitakere Court",
    travelTimeBillingRow: "Travel – Time – necessary",
    travelTimeValue: 1.5,
    returnTravelTime: "1.5 hours",
    mileageBillingRow: "Travel – Personal car – necessary – @ $1.17 per km",
    mileageValue: 49,
    returnDistance: "49km",
    returnKm: 49,
    returnTravelHours: 1.5,
    progressResultsWording: "Travel time and mileage to Waitakere Court return",
  },
];

const SUPPORTED_COURT_LABELS = travelReferences.map((reference) => reference.court).join(", ");
const UNSUPPORTED_COURT_MESSAGE =
  `Unsupported court. Please select one of: ${SUPPORTED_COURT_LABELS}.`;

const courtAliases: Array<{ pattern: RegExp; court: string }> = [
  { pattern: /\bmanukau(?:\s+court)?\b/i, court: "Manukau Court" },
  { pattern: /\bauckland(?:\s+court)?\b/i, court: "Auckland Court" },
  { pattern: /\bnorth\s+shore(?:\s+court)?\b/i, court: "North Shore Court" },
  { pattern: /\bwaitakere(?:\s+court)?\b/i, court: "Waitakere Court" },
];

const knownUnsupportedCourtPattern =
  /\b(Wellington|Dunedin|Christchurch|Hamilton|Tauranga|Rotorua|Whangarei|Nelson|Invercargill|New Plymouth|Palmerston North|Napier|Hastings|Porirua|Lower Hutt)(?:\s+Court)?\b/i;

export const standardBillingWording: Record<BillingCategory, string> = {
  pre_hearing_conference:
    "Received defended Application - All correspondence and phone calls with client, court and counsel with respect to those proceedings. Advise client and instruct Counsel as to the Direction of the proceedings. Inform the Court of Direction required to advance the proceedings. Attendance from [attendance time].",
  judicial_conference:
    "Preparing for Judicial Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties. Attendance at Judicial Conference. Enclosed Notice of Fixture. Directions granted to advance the proceedings.",
  directions_conference:
    "Preparing for Directions Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties.",
  settlement_conference:
    "Prep settlement, review affidavit evidence, advise client of format and rules of engagement for meeting, seek client's instructions and advise client of strategy for the Conference.",
  lawyer_for_child_report:
    "Receipt of Lawyer for Child Report. Perusing report. Considering recommendations. Advising client of impact of report on proceedings.",
  defended_hearing:
    "Defended hearing - review file, prepare for defended hearing, cross examination, brief witness, drafting submissions and reporting to client.",
  consent_memorandum:
    "The parties and Counsel have negotiated a consent memorandum to advance proceedings.",
  complying_judges_directions:
    "The Court directed that parties file further evidence via an affidavit. This has now been completed.",
  general_billing_entry:
    "Draft billing entry prepared from lawyer prompt. Review category, wording, disbursements, and evidence before filing.",
};

function moneyFromPrompt(prompt: string, label: RegExp): number {
  const match = prompt.match(label);
  if (!match?.[1]) return 0;
  return Number.parseFloat(match[1].replace(/,/g, "")) || 0;
}

function inferFormType(prompt: string): BillingFormType {
  if (/33\s*a/i.test(prompt)) return "33A";
  return "32B";
}

function createBillingId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInvoiceNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `INV-${datePart}-${timePart}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function inferCategory(prompt: string): BillingCategory {
  const text = prompt.toLowerCase();

  if (text.includes("pre hearing") || text.includes("pre-hearing")) {
    return "pre_hearing_conference";
  }

  if (text.includes("judicial conference")) return "judicial_conference";
  if (text.includes("directions conference") || text.includes("direction conference")) {
    return "directions_conference";
  }
  if (text.includes("settlement conference")) return "settlement_conference";
  if (text.includes("lawyer for child") || text.includes("lfc")) return "lawyer_for_child_report";
  if (text.includes("defended hearing") || text.includes("hearing")) return "defended_hearing";
  if (text.includes("consent memorandum") || text.includes("consent memo")) return "consent_memorandum";
  if (text.includes("judge") && text.includes("direction")) return "complying_judges_directions";

  return "general_billing_entry";
}

function inferProceedingType(prompt: string, fallback?: string): string {
  const text = prompt.toLowerCase();

  if (text.includes("coca") || text.includes("parenting")) return "COCA / parenting";
  if (text.includes("family violence") || text.includes("protection order")) return "Family violence / protection order";
  if (text.includes("care of children")) return "Care of Children Act";

  return fallback?.trim() || "Family Court";
}

function extractCourt(prompt: string): string {
  const knownCourt = courtAliases.find((alias) => alias.pattern.test(prompt));

  return knownCourt?.court ?? "";
}

function extractUnsupportedCourt(prompt: string): string {
  if (extractCourt(prompt)) return "";

  const knownUnsupportedCourt = prompt.match(knownUnsupportedCourtPattern);
  if (knownUnsupportedCourt?.[1]) {
    return `${knownUnsupportedCourt[1]} Court`;
  }

  const explicitCourt = prompt.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2}\s+Court)\b/);
  return explicitCourt?.[1] ?? "";
}

function extractClient(prompt: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();

  const match = prompt.match(/\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})(?=\s+(?:from|at|on|today|yesterday|tomorrow|,|$))/);
  return match?.[1]?.trim() ?? "";
}

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const suffix = match[3];

  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function extractAttendance(prompt: string): { startTime: string; endTime: string; hours: number } {
  const match = prompt.match(/\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!match) return { startTime: "", endTime: "", hours: 0 };

  const startTime = match[1].replace(/\s+/g, "").toLowerCase();
  let endTime = match[2].replace(/\s+/g, "").toLowerCase();

  if (!/[ap]m$/.test(startTime) && /[ap]m$/.test(endTime)) {
    const suffix = endTime.endsWith("pm") ? "pm" : "am";
    const startWithSuffix = `${startTime}${suffix}`;
    const start = parseTimeToMinutes(startWithSuffix);
    const end = parseTimeToMinutes(endTime);
    return { startTime: startWithSuffix, endTime, hours: minutesToHours(start, end) };
  }

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (!/[ap]m$/.test(endTime) && /[ap]m$/.test(startTime)) {
    const suffix = startTime.endsWith("pm") ? "pm" : "am";
    endTime = `${endTime}${suffix}`;
  }

  return { startTime, endTime, hours: minutesToHours(start, parseTimeToMinutes(endTime)) };
}

function minutesToHours(start: number | null, end: number | null): number {
  if (start === null || end === null) return 0;
  const adjustedEnd = end < start ? end + 24 * 60 : end;
  return Number(((adjustedEnd - start) / 60).toFixed(2));
}

function extractDate(prompt: string): string {
  const today = new Date();
  const text = prompt.toLowerCase();

  if (text.includes("yesterday")) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }

  const explicitDate = prompt.match(/\b(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})\b/);
  if (explicitDate) {
    const day = explicitDate[1].padStart(2, "0");
    const month = explicitDate[2].padStart(2, "0");
    const year = explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3];
    return `${year}-${month}-${day}`;
  }

  return today.toISOString().slice(0, 10);
}

function buildEvidenceRequirements(
  category: BillingCategory,
  prompt: string,
  parking: number,
  uploadedEvidence: string[],
): EvidenceRequirement[] {
  const uploaded = uploadedEvidence.map((item) => item.toLowerCase());
  const requirements: EvidenceRequirement[] = [];
  const add = (type: string, label: string) => {
    requirements.push({
      type,
      label,
      uploaded: uploaded.some((item) => item.includes(type) || item.includes(label.toLowerCase())),
    });
  };

  if (parking > 0) add("parking", "Parking receipt");

  if (["pre_hearing_conference", "judicial_conference", "directions_conference", "settlement_conference"].includes(category)) {
    add("notice", "Notice of fixture or conference notice");
  }

  if (category === "judicial_conference" || category === "directions_conference") {
    add("directions", "Judge's directions");
  }

  if (category === "lawyer_for_child_report" || /report/i.test(prompt)) {
    add("report", "Report relied on for billing");
  }

  if (/agent|counsel/i.test(prompt)) add("agent", "Agent or counsel invoice");

  return requirements;
}

function applyAttendanceTime(wording: string, attendance: { startTime: string; endTime: string }): string {
  if (!attendance.startTime || !attendance.endTime) return wording;
  return wording.replace("[attendance time]", `${attendance.startTime}-${attendance.endTime}`);
}

export function createBillingDraft(input: BillingDraftInput): BillingDraft {
  const prompt = input.prompt.trim();
  const matter = input.matter ?? {};
  const formType = input.formType ?? inferFormType(prompt);
  const category = inferCategory(prompt);
  const court = extractCourt(prompt);
  const unsupportedCourt = extractUnsupportedCourt(prompt);
  const attendance = extractAttendance(prompt);
  const travel = travelReferences.find((reference) => reference.court === court);
  const parking = moneyFromPrompt(prompt, /parking\s+(?:was|of)?\s*\$?([\d,.]+)/i);
  const officeDisbursements = moneyFromPrompt(prompt, /office\s+disbursements?\s+(?:was|of)?\s*\$?([\d,.]+)/i);
  const evidenceRequirements = buildEvidenceRequirements(category, prompt, parking, input.uploadedEvidence ?? []);
  const warnings: string[] = [];

  if (unsupportedCourt) {
    warnings.push(UNSUPPORTED_COURT_MESSAGE);
  } else if (!court) {
    warnings.push(UNSUPPORTED_COURT_MESSAGE);
  }
  if (!attendance.startTime || !attendance.endTime) warnings.push("No attendance time range was identified.");

  const status: BillingStatus = evidenceRequirements.some((requirement) => !requirement.uploaded)
    ? "pending_evidence"
    : "ready_to_review";

  return {
    matterId: matter.matterId?.trim() || createBillingId("matter"),
    clientName: extractClient(prompt, matter.clientName),
    legalAidNumber: matter.legalAidNumber?.trim() ?? "",
    invoiceNumber: matter.invoiceNumber?.trim() || createInvoiceNumber(),
    matterDetails: matter.matterDetails?.trim() ?? "",
    proceedingType: inferProceedingType(prompt, matter.proceedingType),
    formType,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    court,
    date: extractDate(prompt),
    startTime: attendance.startTime,
    endTime: attendance.endTime,
    attendanceHours: attendance.hours,
    travel,
    parking,
    officeDisbursements,
    standardWording: applyAttendanceTime(standardBillingWording[category], attendance),
    evidenceRequirements,
    status,
    templateStatus:
      `Valid source template: ${billingTemplatePaths[formType]}. Final generation uses deterministic placeholder replacement only.`,
    warnings,
  };
}

export function createBillingRecord(input: BillingDraftInput): BillingRecord {
  const draft = createBillingDraft(input);
  const now = new Date().toISOString();

  return {
    id: createBillingId("billing"),
    matterId: draft.matterId,
    clientName: draft.clientName,
    legalAidNumber: draft.legalAidNumber,
    invoiceNumber: draft.invoiceNumber,
    formType: draft.formType,
    status: draft.status,
    draft,
    evidence: draft.evidenceRequirements,
    evidenceStoragePaths: [],
    templatePath: billingTemplatePaths[draft.formType],
    createdAt: now,
    updatedAt: now,
  };
}

export function toBillingRecordRow(record: BillingRecord): BillingRecordRow {
  return {
    id: record.id,
    matter_id: record.matterId,
    client_name: record.clientName,
    legal_aid_number: record.legalAidNumber,
    invoice_number: record.invoiceNumber,
    form_type: record.formType,
    status: record.status,
    draft_json: record.draft,
    evidence_json: record.evidence,
    evidence_storage_paths: record.evidenceStoragePaths,
    template_path: record.templatePath,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}
