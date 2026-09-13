import type { ApplicationType, IntakeData, MatterFile, ProceedingsType } from "./matter";

export const noticeTypes = ["without_notice", "on_notice"] as const;
export type NoticeType = (typeof noticeTypes)[number] | "";

export const noticeTypeLabels: Record<Exclude<NoticeType, "">, string> = {
  without_notice: "Without Notice",
  on_notice: "On Notice",
};

export type OrdersSought = {
  protection: boolean;
  parenting: boolean;
  tenancy: boolean;
  ancillaryFurniture: boolean;
};

export const orderOptions: Array<{ key: keyof OrdersSought; label: string; applicationLabel: string }> = [
  { key: "protection", label: "Protection Order", applicationLabel: "Protection" },
  { key: "parenting", label: "Parenting Order", applicationLabel: "Parenting" },
  { key: "tenancy", label: "Tenancy Order", applicationLabel: "Tenancy" },
  { key: "ancillaryFurniture", label: "Ancillary Furniture Order", applicationLabel: "Ancillary Furniture" },
];

export const emptyOrdersSought: OrdersSought = {
  protection: false,
  parenting: false,
  tenancy: false,
  ancillaryFurniture: false,
};

const applicationToOrder: Record<string, keyof OrdersSought> = {
  "without notice application for protection order": "protection",
  "on notice application for protection order": "protection",
  "without notice application for parenting order": "parenting",
  "on notice application for parenting order": "parenting",
  "without notice application for tenancy order": "tenancy",
  "on notice application for tenancy order": "tenancy",
  "without notice application for ancillary furniture order": "ancillaryFurniture",
  "on notice application for ancillary furniture order": "ancillaryFurniture",
};

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function normalizeApplication(value: string): string {
  return clean(value).toLowerCase();
}

function noticeFromApplication(value: string): NoticeType {
  const normalized = normalizeApplication(value);
  if (normalized.startsWith("without notice")) return "without_notice";
  if (normalized.startsWith("on notice")) return "on_notice";
  return "";
}

export function deriveNoticeType(intake: Pick<IntakeData, "noticeType" | "selectedApplications">): NoticeType {
  if (intake.noticeType === "without_notice" || intake.noticeType === "on_notice") return intake.noticeType;
  for (const application of intake.selectedApplications ?? []) {
    const noticeType = noticeFromApplication(application);
    if (noticeType) return noticeType;
  }
  return "";
}

export function deriveOrdersSought(intake: Pick<IntakeData, "ordersSought" | "selectedApplications" | "proceedingsType">): OrdersSought {
  const orders: OrdersSought = { ...emptyOrdersSought, ...(intake.ordersSought ?? {}) };

  for (const application of intake.selectedApplications ?? []) {
    const order = applicationToOrder[normalizeApplication(application)];
    if (order) orders[order] = true;
  }

  if (intake.proceedingsType === "protection_order" || intake.proceedingsType === "both") {
    orders.protection = true;
  }
  if (intake.proceedingsType === "care_of_children" || intake.proceedingsType === "both") {
    orders.parenting = true;
  }

  return orders;
}

export function proceedingsTypeFromOrders(orders: OrdersSought): ProceedingsType {
  if (orders.protection && orders.parenting) return "both";
  if (orders.protection) return "protection_order";
  if (orders.parenting) return "care_of_children";
  return "";
}

export function selectedApplicationsFromStructured(input: {
  noticeType: NoticeType;
  ordersSought: OrdersSought;
  existingSelectedApplications?: ApplicationType[];
}): ApplicationType[] {
  const noticeLabel = input.noticeType === "on_notice" ? "On Notice" : "Without Notice";
  const generated = orderOptions
    .filter((option) => input.ordersSought[option.key])
    .map((option) => `${noticeLabel} Application for ${option.label}` as ApplicationType);
  const additional = (input.existingSelectedApplications ?? []).filter((application) =>
    !applicationToOrder[normalizeApplication(application)]
  );

  return [...generated, ...additional];
}

export function formatApplications(input: { noticeType: NoticeType; ordersSought: OrdersSought }): string {
  if (!input.noticeType) return "";
  const selected = orderOptions.filter((option) => input.ordersSought[option.key]);
  if (!selected.length) return "";

  const noticeLabel = noticeTypeLabels[input.noticeType];
  if (selected.length === 1) {
    return `${noticeLabel} Application for ${selected[0].label}`;
  }

  return `${noticeLabel} Application for ${formatList(selected.map((option) => option.applicationLabel))} Orders`;
}

function formatSections(sections: number[]): string {
  if (sections.length === 1) return `s ${sections[0]}`;
  return `ss ${formatList(sections.map(String))}`;
}

export function getRelevantLegislation(input: { noticeType: NoticeType; ordersSought: OrdersSought }): string {
  const familyViolenceSections: number[] = [];
  const careOfChildrenSections: number[] = [];

  if (input.ordersSought.protection) {
    familyViolenceSections.push(60);
    if (input.noticeType === "without_notice") familyViolenceSections.push(75);
  }
  if (input.ordersSought.tenancy) familyViolenceSections.push(121, 122);
  if (input.ordersSought.ancillaryFurniture) familyViolenceSections.push(127, 128);
  if (input.ordersSought.parenting) careOfChildrenSections.push(48, 49);

  const parts = [];
  const uniqueFamilyViolenceSections = [...new Set(familyViolenceSections)];
  if (uniqueFamilyViolenceSections.length) {
    parts.push(`Family Violence Act 2018, ${formatSections(uniqueFamilyViolenceSections)}`);
  }
  if (careOfChildrenSections.length) {
    parts.push(`Care of Children Act 2004, ${formatSections([...new Set(careOfChildrenSections)])}`);
  }

  return parts.join("; ");
}

export function getMatterApplicationSelection(matter: MatterFile) {
  const noticeType = deriveNoticeType(matter.intake);
  const ordersSought = deriveOrdersSought(matter.intake);
  return {
    noticeType,
    ordersSought,
    applications: formatApplications({ noticeType, ordersSought }),
    relevantLegislation: getRelevantLegislation({ noticeType, ordersSought }),
  };
}

export function validateApplicationSelection(input: { noticeType: NoticeType; ordersSought: OrdersSought }): string | null {
  if (!input.noticeType) return "Notice type is required before generating the affidavit.";
  if (!orderOptions.some((option) => input.ordersSought[option.key])) {
    return "At least one order must be selected before generating the affidavit.";
  }
  return null;
}
