import type { ApplicationType, Child, MatterFile } from "./matter";
import type { DocxMergeOptions } from "./docx-template";
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

function cleanList(values: string[] | undefined): string[] {
  return (values ?? []).map(clean).filter(Boolean);
}

function matterHasChildren(matter: MatterFile): boolean {
  return matter.intake.children.some((child) => clean(child.fullName));
}

function getDwellingAddress(matter: MatterFile): string {
  return clean(matter.intake.domesticViolenceNotes?.dwellingAddress ?? "")
    || clean(matter.intake.applicant.homeAddress);
}

export function validateAffidavitApplicationSelection(matter: MatterFile): string | null {
  const selection = getMatterApplicationSelection(matter);
  const validationError = validateApplicationSelection(selection);
  if (validationError) return validationError;
  const hasChildren = matterHasChildren(matter);
  if (selection.ordersSought.parenting && !hasChildren) {
    return "At least one child must be added before generating a Parenting Order affidavit.";
  }
  if (selection.ordersSought.tenancy && !getDwellingAddress(matter)) {
    return "A current dwelling address is required before generating a Tenancy Order affidavit.";
  }
  if (selection.ordersSought.ancillaryFurniture && !cleanList(matter.intake.domesticViolenceNotes?.ancillaryFurnitureItems).length) {
    return "At least one furniture or chattel item is required before generating an Ancillary Furniture Order affidavit.";
  }
  if (selection.ordersSought.parenting && !cleanList(matter.intake.domesticViolenceNotes?.parentingSafetyReasons).length) {
    return "At least one parenting safety reason is required before generating a Parenting Order affidavit.";
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
  literalTextReplacements: Record<string, string>;
  removeParagraphsContaining: string[];
  conditionalHeadingSections: Array<{ heading: string; include: boolean }>;
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

function alphaMarker(index: number): string {
  return String.fromCharCode(97 + index);
}

function formatLetteredList(values: string[]): string {
  return values.map((value, index) => `(${alphaMarker(index)}) ${value}`).join("\n");
}

function sentenceJoin(value: string): string {
  const cleaned = clean(value);
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function buildParentingSafetyReasons(matter: MatterFile): string {
  return cleanList(matter.intake.domesticViolenceNotes?.parentingSafetyReasons)
    .map((reason, index) => `(${alphaMarker(index)}) ${sentenceJoin(reason)}`)
    .join("\n");
}

function buildContactSupervisionParagraph(matter: MatterFile): string {
  const reason = clean(matter.intake.domesticViolenceNotes?.contactSupervisionReason ?? "");
  return reason
    ? `I propose that the contact be supervised by a Professional Contact Provider until ${sentenceJoin(reason).replace(/\.$/, "")}.`
    : "I propose that the contact be supervised by a Professional Contact Provider.";
}

function buildFurnitureWithoutNoticeParagraph(matter: MatterFile): string {
  const childReference = matterHasChildren(matter) ? " and a child of my family" : "";
  return `The Application for an Ancillary Furniture Order is made Without Notice to the Respondent because the Respondent has subjected me to the abuse described in this affidavit and the delay that would be caused by proceeding On Notice might expose me${childReference} to further abuse.`;
}

function buildTenancyChildrenParagraph(matter: MatterFile): string {
  const children = matter.intake.children.filter((child) => clean(child.fullName));
  if (!children.length) return "";
  if (children.length === 1) {
    return "It is in the best interests of the child that we remain in the dwelling house. I do not want to leave the dwelling house and uproot the child from their well-established routines.";
  }
  return "It is in the best interests of the children that we remain in the dwelling house. I do not want to leave the dwelling house and uproot the children from their well-established routines.";
}

function buildTenancyOrderParagraph(matter: MatterFile): string {
  const orders = getMatterApplicationSelection(matter).ordersSought;
  const protectionReference = orders.protection
    ? "I am applying for a Protection Order against the Respondent. "
    : "";
  return `${protectionReference}I am also applying for a Tenancy Order granting me the right to live at our current dwelling house, ${getDwellingAddress(matter)}.`;
}

function buildOrdersSought(matter: MatterFile): string {
  const selection = getMatterApplicationSelection(matter);
  const orders = selection.ordersSought;
  const children = matter.intake.children.filter((child) => clean(child.fullName));
  const clauses: string[] = [];

  if (orders.protection) {
    clauses.push("a Protection Order against the Respondent, including the standard conditions of a Protection Order");
  }
  if (orders.parenting) {
    clauses.push(`a Parenting Order granting me day-to-day care of ${children.length === 1 ? "the child" : "the children"}`);
  }
  if (orders.tenancy) {
    clauses.push("a Tenancy Order granting me the right to live at the dwelling house");
  }
  if (orders.ancillaryFurniture) {
    clauses.push("an Ancillary Furniture Order granting me possession and use of the listed furniture and chattels");
  }

  const requestNoun = clauses.length === 1 ? "this order" : "these orders";
  return `I seek ${formatList(clauses)}. I respectfully request that ${requestNoun} be granted ${selection.noticeType === "without_notice" ? "without notice to" : "on notice to"} the Respondent.`;
}

const affidavitSectionHeadings = [
  "Facts in Support of Application for Protection Order Without Notice",
  "FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER",
  "FACTS IN SUPPORT OF APPLICATION FOR A TENANCY ORDER WITHOUT NOTICE",
  "FACTS IN SUPPORT OF APPLICATION FOR ANCILLARY FURNITURE ORDER",
  "FACTS IN SUPPORT OF APPLICATION FOR FURNITURE ORDER WITHOUT NOTICE",
  "MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT",
  "ORDERS SOUGHT",
];

export function buildAffidavitConditionalBlocks(matter: MatterFile): Record<string, boolean> {
  const selection = getMatterApplicationSelection(matter);
  const orders = selection.ordersSought;
  const isWithoutNotice = selection.noticeType === "without_notice";
  const hasChildren = matterHasChildren(matter);

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
  const hasChildren = children.length > 0;
  const dwellingAddress = getDwellingAddress(matter);
  const furnitureItems = cleanList(matter.intake.domesticViolenceNotes?.ancillaryFurnitureItems);

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
    application_intro: content.applicationIntro,
    insert_history_blurb: matter.intake.domesticViolenceNotes?.history ?? "",
    insert_recent_events_blurb: matter.intake.domesticViolenceNotes?.recentEvents ?? "",
    children_blurb: content.childrenParagraphs.join("\n"),
    Children_blurb: content.childrenParagraphs.join("\n"),
    children_harm_reference: hasChildren ? " and the children of my family" : "",
    children_abuse_reference: hasChildren ? "or a child of my family" : "",
    tenancy_protection_reference: orders.protection ? "I am applying for a Protection Order against the Respondent. " : "",
    tenancy_order_paragraph: buildTenancyOrderParagraph(matter),
    furniture_protection_reference: orders.protection ? "I am applying for a Protection Order against the Respondent. " : "",
    tenancy_children_paragraph: buildTenancyChildrenParagraph(matter),
    dwelling_address: dwellingAddress,
    current_dwelling_address: dwellingAddress,
    furniture_order_reference: buildFurnitureWithoutNoticeParagraph(matter),
    furniture_items_list: formatLetteredList(furnitureItems),
    the_child_or_children_possessive: children.length === 1 ? "the child's" : "the children's",
    parenting_safety_reasons: buildParentingSafetyReasons(matter),
    contact_supervision_paragraph: buildContactSupervisionParagraph(matter),
    orders_sought: buildOrdersSought(matter),
    orders_sought_blurb: buildOrdersSought(matter),
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
  const includeParentingProposal = hasParentingOrder && children.length > 0;
  const isWithoutNotice = applicationSelection.noticeType === "without_notice";
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
        buildParentingSafetyReasons(matter),
        buildContactSupervisionParagraph(matter),
      ].filter(Boolean)
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
  const ordersSoughtParagraphs = [buildOrdersSought(matter)];

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
          ...formatViolenceCategories(matter.intake.familyViolenceTypes ?? []),
        ]
      : [],
    parentingHeading: includeParentingProposal
      ? ["MY PROPOSAL FOR DAY-TO-DAY CARE AND CONTACT"]
      : [],
    parentingParagraphs,
    ordersSoughtParagraphs,
    conditionalBlocks: buildAffidavitConditionalBlocks(matter),
    mergeFields: {},
    literalTextReplacements: {
      "I am applying without notice for a Protection Order against {{respondent_name}} (“the Respondent”).": "{{application_intro}}",
      "{{tenancy_protection_reference}}I am also applying for a Tenancy Order grantingme the right to live at our current dwelling house, {{dwelling_address}}.": "{{tenancy_order_paragraph}}",
      "{{tenancy_children_paragraph}} It is in the best interests of our child that we remain in the dwelling house given the house is very near to her pre school and friends. I do not want to leave the dwelling house and uproot my child from their well established routines.": "{{tenancy_children_paragraph}}",
      "{{parenting_safety_reasons}} I am concerned that the Respondent is unable to control his anger and does not realise that his behaviour is abusive.": "{{parenting_safety_reasons}}",
      "I propose that the contact be supervised by a Professional Contact Provider until he addresses his mental health.": "{{contact_supervision_paragraph}}",
      "I seek Orders granting the child and myself a Protection Order, Tenancy and Ancillary Furniture against the Respondent.  I seek the standard conditions of a Protection Order.  I also seek a Parenting Order granting me the day to day care of the child. I request these orders are granted without notice to the Respondent.": "{{orders_sought}}",
      "I am also applying for an Ancillary Furniture Order granting me the right to possession and use of the furniture and chattels listed below.": "I am also applying for an Ancillary Furniture Order granting me the right to possession and use of the furniture and chattels listed below.\n{{furniture_items_list}}",
    },
    removeParagraphsContaining: [
      "I'm concerned about the child/ren being with him while he's in the mental state of having uncontrollable thoughts and not being able to think clearly.",
      "Microwave",
      "Child's bedroom furniture",
      "Lounge Suite",
      "Television",
      "Fridge",
      "Freezer",
      "Washing Machine",
    ],
    conditionalHeadingSections: [
      { heading: affidavitSectionHeadings[0], include: hasProtectionOrder && isWithoutNotice },
      { heading: affidavitSectionHeadings[1], include: applicationSelection.ordersSought.tenancy },
      { heading: affidavitSectionHeadings[2], include: applicationSelection.ordersSought.tenancy && isWithoutNotice },
      { heading: affidavitSectionHeadings[3], include: applicationSelection.ordersSought.ancillaryFurniture },
      { heading: affidavitSectionHeadings[4], include: applicationSelection.ordersSought.ancillaryFurniture && isWithoutNotice },
      { heading: affidavitSectionHeadings[5], include: hasParentingOrder },
      { heading: affidavitSectionHeadings[6], include: true },
    ],
  };
}

export function buildAffidavitDocxMergeOptions(
  matter: MatterFile,
  content = buildStandardAffidavitContent(matter),
): DocxMergeOptions {
  return {
    conditionalBlocks: content.conditionalBlocks,
    conditionalHeadingSections: content.conditionalHeadingSections,
    removeParagraphsContaining: content.removeParagraphsContaining,
    literalTextReplacements: {
      "AFFIRMED at {{English_court_name}} this": "AFFIRMED at            this",
      ...content.literalTextReplacements,
    },
    affidavitFormatting: {
      applicantName: matter.intake.applicant.fullName.toLocaleUpperCase("en-NZ"),
      respondentName: matter.intake.respondent.fullName.toLocaleUpperCase("en-NZ"),
      childNames: matter.intake.children.map((child) => child.fullName.toLocaleUpperCase("en-NZ")),
      legislationLines: content.legislationLines,
    },
    paragraphInsertions: {
      children_blurb: content.childrenParagraphs,
      Children_blurb: content.childrenParagraphs,
      protection_facts_heading: content.protectionFactsHeading,
      violence_categories: content.violenceCategories,
      insert_history_blurb: [matter.intake.domesticViolenceNotes?.history ?? ""],
      insert_recent_events_blurb: [matter.intake.domesticViolenceNotes?.recentEvents ?? ""],
      without_notice_heading: content.withoutNoticeHeading,
      without_notice_intro: content.withoutNoticeIntro,
      without_notice_safety: content.withoutNoticeSafetyFactors,
      parenting_heading: content.parentingHeading,
      parenting_blurb: content.parentingParagraphs,
      orders_sought_blurb: content.ordersSoughtParagraphs,
    },
  };
}
