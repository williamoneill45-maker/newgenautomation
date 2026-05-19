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
  fixedFeePlusActivities: {
    travelTimeHourlyRate: 63,
  },
  totalRules: {
    totalApplication:
      "Sum of applicant fixed fee rows from Termination of Instructions through Subsequent Direction(s).",
    totalDisbursementsExcludingMileage:
      "Sum of disbursement rows from Disbursements through Prior approval disbursements, excluding mileage.",
  },
} as const;

export const form33ASettingsStorageKey = "newgenautomation.form33a.management.settings";

export type Form33ARuleSettings = {
  wordingByRuleId: Record<string, string>;
  statusByRuleId: Record<string, Form33AManagementRule["status"]>;
  fixNotesByRuleId: Record<string, string>;
};

export type Form33AManagementRule = {
  id: string;
  section: string;
  keyword: string;
  formRow: string;
  placeholders: string[];
  quantityRule: string;
  feeRule: string;
  totalBucket: "Applicant fixed fees" | "Fixed fee plus activities" | "Disbursements" | "Mileage" | "Review required";
  gstTreatment: string;
  standardWording: string;
  status: "Active" | "Partial" | "Needs review";
  inactiveReason: string;
  howToFix: string;
};

export const form33AManagementRules: Form33AManagementRule[] = [
  {
    id: "judicial-conference",
    section: "Pre-hearing matters",
    keyword: "judicial conference, pre-hearing conference",
    formRow: "Judicial Conference(s) - Preparation; Judicial Conference(s) - Hearing time",
    placeholders: [
      "JC_PREP_QTY",
      "JC_PREP_UNIT",
      "JC_PREP_TOTAL",
      "JC_HEARING_QTY",
      "JC_HEARING_UNIT",
      "JC_HEARING_TOTAL",
    ],
    quantityRule: "Preparation is 1. Hearing time is rounded up in 30 minute units.",
    feeRule: `$${form33AFeeRules.fixedFees.judicialConferencePreparation} preparation + $${form33AFeeRules.fixedFees.judicialConferenceHearingPerHalfHour} per half hour hearing time.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Preparing for Judicial Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties. Enclosed Notice of Fixture, Directions granted to advance the proceedings. Attendance at Judicial Conference on [billing date] from [attendance time].",
    status: "Active",
    inactiveReason: "No blocker. Prompt parsing, placeholders, pricing, wording, and travel references are implemented for the current demo path.",
    howToFix: "Keep testing real examples. If wording changes, edit the wording here; the billing workbench will use saved local wording for new drafts until Supabase persistence is added.",
  },
  {
    id: "formal-proof",
    section: "Applications and orders",
    keyword: "formal proof, formal proof hearing",
    formRow: "Formal proof hearing - Preparation; Formal proof hearing - Hearing time",
    placeholders: [
      "FORMAL_PROOF_PREP_QTY",
      "FORMAL_PROOF_PREP_UNIT",
      "FORMAL_PROOF_PREP_TOTAL",
      "FORMAL_PROOF_HEARING_QTY",
      "FORMAL_PROOF_HEARING_UNIT",
      "FORMAL_PROOF_HEARING_TOTAL",
    ],
    quantityRule: "Preparation is 1. Hearing time is rounded up in 30 minute units.",
    feeRule: `$${form33AFeeRules.fixedFees.formalProofPreparation} preparation + $${form33AFeeRules.fixedFees.formalProofHearingPerHalfHour} per half hour hearing time.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Formal Proof Hearing preparation, taking instructions, reviewing evidence, preparing for hearing, attendance at hearing on [billing date] from [attendance time].",
    status: "Partial",
    inactiveReason: "Rule is mapped, but real examples and final wording have not been fully checked end to end.",
    howToFix: "Enter final wording, run a real formal proof prompt in the tester, confirm quantity and totals, then mark the working status as Active.",
  },
  {
    id: "judge-directions",
    section: "Defended hearings",
    keyword: "judge directions, complying with judge's directions",
    formRow: "Complying with Judge's directions",
    placeholders: ["JUDGE_DIRECTIONS"],
    quantityRule: "Single fixed amount.",
    feeRule: `$${form33AFeeRules.fixedFees.judgeDirections} fixed fee.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Complying with Judge's directions, reviewing directions, completing required work, correspondence and reporting to client.",
    status: "Partial",
    inactiveReason: "Placeholder and price exist, but trigger wording and evidence requirements need confirmation.",
    howToFix: "Confirm the exact prompt phrases lawyers will type and the wording that should be inserted. Then test the prompt and mark Active.",
  },
  {
    id: "pre-hearing-matters",
    section: "Pre-hearing matters",
    keyword: "pre-hearing matters",
    formRow: "Pre-hearing matters",
    placeholders: ["PH_MATTERS"],
    quantityRule: "Single fixed amount; no separate quantity placeholder.",
    feeRule: `$${form33AFeeRules.fixedFees.preHearingMatters} fixed fee.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Pre-hearing matters including reviewing evidence, advising client, correspondence with parties and preparing matter for next procedural step.",
    status: "Partial",
    inactiveReason: "Placeholder and price exist, but it needs real prompt examples to avoid clashing with Judicial Conference wording.",
    howToFix: "Add example prompts that mean this row only, test them, and confirm the inserted wording.",
  },
  {
    id: "defended-hearing",
    section: "Defended hearings",
    keyword: "defended hearing, short cause fixture",
    formRow: "Defended hearing(s) - Preparation; Defended hearing(s) - Hearing time",
    placeholders: [
      "DH_PREP_QTY",
      "DH_PREP_UNIT",
      "DH_PREP_TOTAL",
      "DH_HEAR_QTY",
      "DH_HEAR_UNIT",
      "DH_HEAR_TOTAL",
    ],
    quantityRule: "Preparation is 1. Hearing time is rounded up in 30 minute units.",
    feeRule: `$${form33AFeeRules.fixedFees.defendedHearingPreparation} preparation + $${form33AFeeRules.fixedFees.defendedHearingPerHalfHour} per half hour hearing time.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Defended hearing - review file, prepare for defended hearing, cross examination, brief witness, drafting submissions and reporting to client.",
    status: "Partial",
    inactiveReason: "Pricing and placeholders are mapped, but defended-hearing quantity examples need review.",
    howToFix: "Test a defended hearing prompt with a known duration and confirm prep, hearing quantity, totals, GST, and wording.",
  },
  {
    id: "defended-protection-order",
    section: "Applications and orders",
    keyword: "defended protection order",
    formRow: "Defended Protection Order",
    placeholders: ["DPO"],
    quantityRule: "Single fixed amount.",
    feeRule: `$${form33AFeeRules.fixedFees.defendedProtectionOrder} fixed fee.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Defended protection order preparation, reviewing application and evidence, advising client, correspondence and attendance-related preparation.",
    status: "Partial",
    inactiveReason: "Placeholder and price exist, but final standard wording and trigger phrases need confirmation.",
    howToFix: "Confirm the exact wording and example prompts for this row, then test the generated draft.",
  },
  {
    id: "instructing-agent",
    section: "Agent attendances",
    keyword: "instructing agent, agent appearance, agent appears",
    formRow: "Instructing agent - Judicial Conference; Instructing agent - Formal proof hearing; Defended hearing - instructing agent",
    placeholders: [
      "JC_AGENT_QTY",
      "JC_AGENT_UNIT",
      "JC_AGENT_TOTAL",
      "FP_AGENT_QTY",
      "FP_AGENT_UNIT",
      "FP_AGENT_TOTAL",
      "DH_AGENT_QTY",
      "DH_AGENT_UNIT",
      "DH_AGENT_TOTAL",
    ],
    quantityRule: "Single fixed amount; row depends on whether the prompt says judicial conference, formal proof, or defended hearing.",
    feeRule: `$${form33AFeeRules.fixedFees.judicialConferenceAgent} fixed fee.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Instructing agent to attend on behalf of counsel, reviewing agent report, correspondence and reporting to client.",
    status: "Partial",
    inactiveReason: "This rule can map to three different agent rows, so prompt context must be checked carefully.",
    howToFix: "Test one prompt each for Judicial Conference agent, Formal Proof agent, and Defended Hearing agent. Confirm the correct row fills.",
  },
  {
    id: "additional-factors",
    section: "Additional factors",
    keyword: "additional factors",
    formRow: "Additional factors",
    placeholders: ["AF_A_O", "AF_P_H", "AF_D_H"],
    quantityRule: "Single fixed amount; section depends on prompt context.",
    feeRule: `$${form33AFeeRules.fixedFees.preHearingAdditionalFactors} fixed fee.`,
    totalBucket: "Applicant fixed fees",
    gstTreatment: "GST applies through the total GST calculation.",
    standardWording:
      "Additional factors including additional complexity, party conduct, self-represented party issues, or additional work required to progress the matter.",
    status: "Needs review",
    inactiveReason: "Additional factors can sit under different sections, so the app needs clearer prompt examples before it should be active.",
    howToFix: "Provide examples for applications/orders, pre-hearing, and defended hearing additional factors. Confirm which placeholder each example should fill.",
  },
  {
    id: "travel-time",
    section: "Travel",
    keyword: "Manukau Court, Auckland Court, North Shore Court, Waitakere Court",
    formRow: "Travel - Time - necessary",
    placeholders: ["travel_time", "travel time", "tt_total"],
    quantityRule: "Uses the supported court travel time reference.",
    feeRule: `$${form33AFeeRules.fixedFeePlusActivities.travelTimeHourlyRate} per hour.`,
    totalBucket: "Disbursements",
    gstTreatment: "GST applies through total disbursements excluding mileage.",
    standardWording: "Travel time and mileage to [court] return",
    status: "Needs review",
    inactiveReason: "Travel time now feeds td as a non-mileage disbursement, but should be tested against real examples before marking fully active.",
    howToFix: "Run prompts with travel time, parking, office disbursements, and mileage. Confirm td includes all non-mileage disbursements and m_t carries mileage only.",
  },
  {
    id: "mileage",
    section: "Travel",
    keyword: "Manukau Court, Auckland Court, North Shore Court, Waitakere Court",
    formRow: "Travel - Personal car - necessary",
    placeholders: ["mileage", "m_t"],
    quantityRule: "Uses the supported court return kilometre reference.",
    feeRule: `$${form33AFeeRules.mileageRatePerKm} per kilometre.`,
    totalBucket: "Mileage",
    gstTreatment: "Mileage does not attract GST.",
    standardWording: "",
    status: "Active",
    inactiveReason: "No blocker. Mileage uses the supported court kilometre reference and does not attract GST.",
    howToFix: "Keep testing court examples. If the mileage total placeholder changes again, update this placeholder list and the merge field.",
  },
];
