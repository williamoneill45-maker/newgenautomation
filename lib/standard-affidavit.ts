import type { ApplicationType, Child, MatterFile } from "./matter";
import {
  getMatterApplicationSelection,
  validateApplicationSelection,
} from "./application-orders.ts";

const protectionOrderApplication = "Without Notice Application for Protection Order";
const parentingOrderApplication = "Without Notice Application for Parenting Order";
const onNoticeProtectionOrderApplication = "On Notice Application for Protection Order";
const onNoticeParentingOrderApplication = "On Notice Application for Parenting Order";
const tenancyOrderPattern = /tenancy order/i;
const ancillaryFurnitureOrderPattern = /ancillary furniture order/i;
const consentedProtectedPersonApplication = "Consent to Being Named as a Protected Person";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstName(value: string): string {
  return clean(value).split(" ")[0] ?? "";
}

function toTitleCaseName(value: string): string {
  return value
    .toLocaleLowerCase("en-NZ")
    .replace(/[A-Za-z][A-Za-z'-]*/g, (word) =>
      word.charAt(0).toLocaleUpperCase("en-NZ") + word.slice(1),
    );
}

function formatInputDateLong(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean(value);

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return clean(value);

  return `${formatOrdinalDay(date.getDate())} of ${new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

function formatOrdinalDay(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatList(values: string[]): string {
  const cleanValues = values.map(clean).filter(Boolean);
  if (cleanValues.length <= 1) return cleanValues[0] ?? "";
  if (cleanValues.length === 2) return `${cleanValues[0]} and ${cleanValues[1]}`;
  return `${cleanValues.slice(0, -1).join(", ")}, and ${cleanValues.at(-1)}`;
}

function childDescription(child: Child): string {
  const name = clean(child.fullName).toLocaleUpperCase("en-NZ");
  const dob = formatInputDateLong(child.dateOfBirth);
  const nickname = toTitleCaseName(firstName(child.fullName));
  return [
    `[[b]]${name}[[/b]]`,
    dob ? `born ${dob}` : "",
    nickname ? `(“${nickname}”)` : "",
  ].filter(Boolean).join(", ");
}

function childCareName(child: Child): string {
  return toTitleCaseName(firstName(clean(child.fullName)));
}

function orderLabel(application: ApplicationType, otherDetails: string): string {
  if (application === protectionOrderApplication || application === onNoticeProtectionOrderApplication) return "Protection Order";
  if (application === parentingOrderApplication || application === onNoticeParentingOrderApplication) return "Parenting Order";
  if (tenancyOrderPattern.test(application)) return "Tenancy Order";
  if (ancillaryFurnitureOrderPattern.test(application)) return "Ancillary Furniture Order";
  if (application === consentedProtectedPersonApplication) return "";
  if (application === "Fee Waiver") return "";
  if (application === "Other") return clean(otherDetails) || "other order";
  return application;
}

function withIndefiniteArticle(value: string): string {
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value}`;
}

export function isProtectionOrderSought(matter: MatterFile): boolean {
  const selection = getMatterApplicationSelection(matter);
  if (selection.ordersSought.protection) return true;
  return matter.intake.selectedApplications.some((application) => /protection order/i.test(application)) ||
    matter.intake.proceedingsType === "protection_order" ||
    matter.intake.proceedingsType === "both";
}

export function isParentingOrderSought(matter: MatterFile): boolean {
  const selection = getMatterApplicationSelection(matter);
  if (selection.ordersSought.parenting) return true;
  return matter.intake.selectedApplications.some((application) => /parenting order/i.test(application)) ||
    matter.intake.proceedingsType === "care_of_children" ||
    matter.intake.proceedingsType === "both";
}

export function isTenancyOrderSought(matter: MatterFile): boolean {
  return getMatterApplicationSelection(matter).ordersSought.tenancy;
}

export function isAncillaryFurnitureOrderSought(matter: MatterFile): boolean {
  return getMatterApplicationSelection(matter).ordersSought.ancillaryFurniture;
}

export function validateAffidavitApplicationSelection(matter: MatterFile): string | null {
  const selection = getMatterApplicationSelection(matter);
  const validationError = validateApplicationSelection(selection);
  if (validationError) return validationError;
  const hasChildren = matter.intake.children.some((child) => clean(child.fullName));
  if (selection.ordersSought.parenting && !hasChildren) {
    return "At least one child must be added before generating a Parenting Order affidavit.";
  }
  return null;
}

function violenceCategoryLabel(value: string): string {
  return clean(value).replace(/^./, (letter) => letter.toLocaleUpperCase("en-NZ"));
}

function formatViolenceCategories(values: string[]): string[] {
  return values.map((value, index) => {
    const marker = String.fromCharCode(97 + index);
    const punctuation = index === values.length - 1 ? "" : index === 0 ? "." : ";";
    return `(${marker})                ${violenceCategoryLabel(value)}${punctuation}`;
  });
}

export type StandardAffidavitContent = {
  applicationTitle: string;
  legislationLines: string[];
  applicationIntro: string;
  relationshipStartBlurb: string;
  relationshipEnd: string;
  childrenParagraphs: string[];
  protectionFactsHeading: string[];
  violenceCategories: string[];
  withoutNoticeHeading: string[];
  withoutNoticeIntro: string[];
  withoutNoticeSafetyFactors: string[];
  parentingHeading: string[];
  parentingParagraphs: string[];
  ordersSoughtParagraphs: string[];
  conditionalBlocks: Record<string, boolean>;
  mergeFields: Record<string, string>;
};

function buildChildGrammar(children: Child[]): Record<string, string> {
  const multipleChildren = children.length !== 1;
  return {
    child_or_children: multipleChildren ? "children" : "child",
    child_or_children_cap: multipleChildren ? "Children" : "Child",
    the_child_or_children: multipleChildren ? "the children" : "the child",
    the_child_or_children_cap: multipleChildren ? "The children" : "The child",
    child_possessive: multipleChildren ? "children's" : "child's",
    child_has_or_have: multipleChildren ? "have" : "has",
    child_is_or_are: multipleChildren ? "are" : "is",
    child_was_or_were: multipleChildren ? "were" : "was",
    child_them: "them",
    child_they: "they",
    child_their: "their",
  };
}

function boolString(value: boolean): string {
  return value ? "true" : "";
}

export function buildAffidavitConditionalBlocks(matter: MatterFile): Record<string, boolean> {
  const selection = getMatterApplicationSelection(matter);
  const orders = selection.ordersSought;
  const isWithoutNotice = selection.noticeType === "without_notice";
  const hasChildren = matter.intake.children.some((child) => clean(child.fullName));

  return {
    has_children: hasChildren,
    children_blurb_block: hasChildren,
    protection_facts_block: orders.protection,
    protection_without_notice_block: orders.protection && isWithoutNotice,
    tenancy_facts_block: orders.tenancy,
    tenancy_without_notice_block: orders.tenancy && isWithoutNotice,
    ancillary_furniture_facts_block: orders.ancillaryFurniture,
    ancillary_furniture_without_notice_block: orders.ancillaryFurniture && isWithoutNotice,
    furniture_without_notice_block: orders.ancillaryFurniture && isWithoutNotice,
    parenting_block: orders.parenting,
    parenting_proposal_block: orders.parenting,
    orders_sought_block: orders.protection || orders.parenting || orders.tenancy || orders.ancillaryFurniture,
    orders_sought_protection_clause: orders.protection,
    orders_sought_parenting_clause: orders.parenting,
    orders_sought_tenancy_clause: orders.tenancy,
    orders_sought_ancillary_furniture_clause: orders.ancillaryFurniture,
    orders_sought_furniture_clause: orders.ancillaryFurniture,
    orders_sought_without_notice_clause: isWithoutNotice,
    protection_reference_clause: orders.protection,
    no_protection_reference_clause: !orders.protection,
  };
}

export function buildAffidavitMergeFields(matter: MatterFile, content = buildStandardAffidavitContent(matter)): Record<string, string> {
  const selection = getMatterApplicationSelection(matter);
  const orders = selection.ordersSought;
  const children = matter.intake.children.filter((child) => clean(child.fullName));
  const childNames = children.map(childCareName);
  const formattedChildNames = childNames.length ? formatList(childNames) : "";
  const conditionalBlocks = buildAffidavitConditionalBlocks(matter);

  return {
    ...buildChildGrammar(children),
    has_children: boolString(conditionalBlocks.has_children),
    has_protection_order: boolString(orders.protection),
    has_parenting_order: boolString(orders.parenting),
    has_tenancy_order: boolString(orders.tenancy),
    has_ancillary_furniture_order: boolString(orders.ancillaryFurniture),
    is_without_notice: boolString(selection.noticeType === "without_notice"),
    is_on_notice: boolString(selection.noticeType === "on_notice"),
    selected_child_names: formattedChildNames,
    children_names: formattedChildNames,
    applications: selection.applications.toLocaleUpperCase("en-NZ"),
    applications_upper: selection.applications.toLocaleUpperCase("en-NZ"),
    relevant_legislation: selection.relevantLegislation,
    relevant_legisaltion: selection.relevantLegislation,
    children_blurb: content.childrenParagraphs.join("\n"),
    dwelling_address: matter.intake.applicant.homeAddress,
    current_dwelling_address: matter.intake.applicant.homeAddress,
  };
}

export function buildStandardAffidavitContent(matter: MatterFile): StandardAffidavitContent {
  const applicationSelection = getMatterApplicationSelection(matter);
  const hasProtectionOrder = isProtectionOrderSought(matter);
  const hasParentingOrder = isParentingOrderSought(matter);
  const respondentName = clean(matter.intake.respondent.fullName).toLocaleUpperCase("en-NZ") || "the Respondent";
  const children = matter.intake.children
    .filter((child) => clean(child.fullName));
  const formattedChildNames = children.length
    ? formatList(children.map(childCareName))
    : "the children";
  const selectedOrderLabels = matter.intake.selectedApplications
    .map((application) => orderLabel(application, matter.intake.otherApplicationDetails))
    .filter(Boolean);
  const orderLabels = selectedOrderLabels.length
    ? selectedOrderLabels
    : [
        applicationSelection.ordersSought.protection ? "Protection Order" : "",
        applicationSelection.ordersSought.parenting ? "Parenting Order" : "",
        applicationSelection.ordersSought.tenancy ? "Tenancy Order" : "",
        applicationSelection.ordersSought.ancillaryFurniture ? "Ancillary Furniture Order" : "",
      ].filter(Boolean);
  const formattedOrders = formatList(orderLabels);
  const includeParentingProposal = hasParentingOrder && children.length > 0;
  const isWithoutNotice = applicationSelection.noticeType === "without_notice" || matter.intake.selectedApplications.some((application) =>
    /^without notice/i.test(application),
  ) || (!matter.intake.selectedApplications.length && hasProtectionOrder);
  const legislationLines = applicationSelection.relevantLegislation
    ? [`(${applicationSelection.relevantLegislation})`]
    : [];
  const relationship = matter.intake.relationship;
  const relationshipStartBlurb = relationship.marriageOrCivilUnionDate
    ? `married${clean(relationship.marriageOrCivilUnionPlace) ? ` in ${clean(relationship.marriageOrCivilUnionPlace)}` : ""} on ${formatInputDateLong(relationship.marriageOrCivilUnionDate)}`
    : relationship.deFactoRelationshipStart
      ? `in a de facto relationship from approximately ${formatInputDateLong(relationship.deFactoRelationshipStart)}`
      : "in a family relationship";

  const applicationTitle = applicationSelection.applications
    ? applicationSelection.applications.toLocaleUpperCase("en-NZ")
    : `${isWithoutNotice ? "WITHOUT NOTICE" : "ON NOTICE"} APPLICATION FOR ${(orderLabels[0] || "PROTECTION ORDER").toUpperCase()}`;

  const applicationIntro = orderLabels.length > 1
    ? `I am applying ${isWithoutNotice ? "without notice" : "on notice"} for ${formatList(orderLabels.map(withIndefiniteArticle))} against ${respondentName} (“the Respondent”).`
    : `I am applying ${isWithoutNotice ? "without notice" : "on notice"} for ${withIndefiniteArticle(orderLabels[0] || "Protection Order")} against ${respondentName} (“the Respondent”).`;

  const childrenParagraphs = children.length
    ? [`The Respondent and I are the parents of the following ${children.length === 1 ? "child" : "children"}:\n${children.map(childDescription).join(";\n")}.`]
    : [];

  const parentingParagraphs = includeParentingProposal
    ? [
        `I seek a Parenting Order granting me day-to-day care of ${formattedChildNames}. I have always had a greater role and responsibility in providing day-to-day care to ${formattedChildNames}. I want this arrangement to continue and for ${formattedChildNames} to remain in my day-to-day care.`,
        `I seek an interim Parenting Order granting the Respondent supervised contact with ${formattedChildNames}. I am concerned about ${formattedChildNames}’s safety in the Respondent’s unsupervised care because:  (i) ${formattedChildNames} ${children.length === 1 ? "has" : "have"} been exposed to the Respondent’s violence towards me and ${children.length === 1 ? "has" : "have"} been affected by the abuse ${children.length === 1 ? "the child has" : "they have"} witnessed.  (ii) I am concerned that the Respondent is unable to control his anger and does not realise that his behaviour is abusive.  (iii) I want to be sure that ${formattedChildNames} ${children.length === 1 ? "is" : "are"} safe and ${children.length === 1 ? "is" : "are"} returned to me at the end of any contact. I am concerned that without an order the Respondent may refuse to return ${formattedChildNames}.`,
        "I propose that contact be supervised by a Professional Contact Provider.",
      ].flatMap((paragraph) => paragraph.split(/\s{2,}(?=\([ivx]+\))/i))
        .map((paragraph) => paragraph
          .replace(/the children has/g, "the children have")
          .replace(/the child has/g, "they have")
          .replace(/the children is/g, "the children are")
          .replace(/and has been affected/g, "and have been affected")
          .replace(/and is returned/g, "and are returned"))
    : [];

  const orders: string[] = [];
  if (hasProtectionOrder) {
    orders.push("a Protection Order against the Respondent");
  }
  if (hasParentingOrder) {
    orders.push("a Parenting Order granting me day-to-day care");
  }
  if (applicationSelection.ordersSought.tenancy) {
    orders.push("a Tenancy Order");
  }
  if (applicationSelection.ordersSought.ancillaryFurniture) {
    orders.push("an Ancillary Furniture Order");
  }
  const reliefExcludedApplications: ApplicationType[] = [
        protectionOrderApplication,
        parentingOrderApplication,
        onNoticeProtectionOrderApplication,
        onNoticeParentingOrderApplication,
        "Without Notice Application for Tenancy Order",
        "On Notice Application for Tenancy Order",
        "Without Notice Application for Ancillary Furniture Order",
        "On Notice Application for Ancillary Furniture Order",
        consentedProtectedPersonApplication,
        "Fee Waiver",
      ];
  matter.intake.selectedApplications
    .filter((application) => !reliefExcludedApplications.includes(application))
    .forEach((application) => orders.push(orderLabel(application, matter.intake.otherApplicationDetails)));
  const consentedProtectedPerson = clean(matter.intake.consentedProtectedPersonName ?? "");
  if (consentedProtectedPerson) {
    orders.push(`a Protection Order to extend to the following consented person ${consentedProtectedPerson.toLocaleUpperCase("en-NZ")}`);
  }
  const formattedOrderRelief = formatList(orders);
  const standardConditions = hasProtectionOrder
    ? " I seek the standard conditions of a Protection Order."
    : "";
  const requestNoun = orders.length === 1 ? "this order" : "these orders";
  const ordersSoughtParagraphs = [
    `I seek ${formattedOrderRelief || formattedOrders || "the orders set out in my application"}.${standardConditions} I respectfully request that ${requestNoun} be granted ${isWithoutNotice ? "without notice to" : "on notice to"} the Respondent.`,
  ];

  return {
    applicationTitle,
    legislationLines,
    applicationIntro,
    relationshipStartBlurb,
    relationshipEnd: formatInputDateLong(relationship.relationshipEndDate),
    childrenParagraphs,
    protectionFactsHeading: hasProtectionOrder
      ? ["FACTS IN SUPPORT OF APPLICATION FOR PROTECTION ORDER"]
      : [],
    withoutNoticeHeading: hasProtectionOrder && isWithoutNotice
      ? ["FACTS IN SUPPORT OF APPLICATION FOR PROTECTION ORDER WITHOUT NOTICE"]
      : [],
    withoutNoticeIntro: hasProtectionOrder && isWithoutNotice
      ? ["The Application for a Protection Order is being made without notice to the Respondent because the delay that would be caused by proceeding on notice would or might entail a risk of harm and undue hardship to me and the children of my family as follows:"]
      : [],
    withoutNoticeSafetyFactors: hasProtectionOrder && isWithoutNotice
      ? [
          "I am very fearful for my safety and also the children’s safety.",
          "I believe that if the Respondent knew that I was applying for this Order, I may suffer further physical abuse and/or psychological abuse.",
        ]
      : [],
    violenceCategories: hasProtectionOrder
      ? [
          "Facts relating to Respondent",
          "The Respondent has used family violence against me as follows:",
          ...formatViolenceCategories(matter.intake.familyViolenceTypes?.length
            ? matter.intake.familyViolenceTypes
            : ["physical abuse", "psychological abuse", "damage to property", "sexual abuse"]),
        ]
      : [],
    parentingHeading: includeParentingProposal
      ? ["MY PROPOSAL FOR DAY-TO-DAY CARE AND CONTACT"]
      : [],
    parentingParagraphs,
    ordersSoughtParagraphs,
    conditionalBlocks: buildAffidavitConditionalBlocks(matter),
    mergeFields: {},
  };
}
