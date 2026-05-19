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
} as const;

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
      "Preparing for Judicial Conference, taking client's instructions, advising of procedural steps, advising of what will take place at the Conference. All correspondence and calls with Counsel and parties. Enclosed Notice of Fixture, Directions granted to advance the proceedings. Attendance at Pre-Hearing Conference on [billing date] from [attendance time].",
    status: "Active",
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
  },
  {
    id: "travel-time",
    section: "Travel",
    keyword: "Manukau Court, Auckland Court, North Shore Court, Waitakere Court",
    formRow: "Travel - Time - necessary",
    placeholders: ["travel_time", "travel time", "tt_total"],
    quantityRule: "Uses the supported court travel time reference.",
    feeRule: `$${form33AFeeRules.fixedFeePlusActivities.travelTimeHourlyRate} per hour.`,
    totalBucket: "Fixed fee plus activities",
    gstTreatment: "Currently treated as GST-bearing fixed fee plus activity; confirm if this should move to disbursements.",
    standardWording: "Travel time and mileage to [court] return",
    status: "Needs review",
  },
  {
    id: "mileage",
    section: "Travel",
    keyword: "Manukau Court, Auckland Court, North Shore Court, Waitakere Court",
    formRow: "Travel - Personal car - necessary",
    placeholders: ["mileage", "mileage_total", "m", "tm"],
    quantityRule: "Uses the supported court return kilometre reference.",
    feeRule: `$${form33AFeeRules.mileageRatePerKm} per kilometre.`,
    totalBucket: "Mileage",
    gstTreatment: "Mileage does not attract GST.",
    standardWording: "Travel time and mileage to [court] return",
    status: "Active",
  },
];

