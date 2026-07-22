import type { ApplicationType, Child, MatterFile } from "./matter";

const protectionOrderApplication = "Without Notice Application for Protection Order";
const parentingOrderApplication = "Without Notice Application for Parenting Order";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstName(value: string): string {
  return clean(value).split(" ")[0] ?? "";
}

function formatInputDateLong(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean(value);

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return clean(value);

  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatList(values: string[]): string {
  const cleanValues = values.map(clean).filter(Boolean);
  if (cleanValues.length <= 1) return cleanValues[0] ?? "";
  if (cleanValues.length === 2) return `${cleanValues[0]} and ${cleanValues[1]}`;
  return `${cleanValues.slice(0, -1).join(", ")}, and ${cleanValues.at(-1)}`;
}

function childFirstName(child: Child): string {
  return firstName(child.fullName) || clean(child.fullName);
}

function possessive(value: string): string {
  return value.endsWith("s") ? `${value}’` : `${value}’s`;
}

function childDescription(child: Child): string {
  const name = clean(child.fullName).toLocaleUpperCase("en-NZ");
  const dob = formatInputDateLong(child.dateOfBirth);
  const nickname = firstName(name);
  return [
    name,
    dob ? `born ${dob}` : "",
    nickname ? `(“${nickname}”)` : "",
  ].filter(Boolean).join(", ");
}

function orderLabel(application: ApplicationType, otherDetails: string): string {
  if (application === protectionOrderApplication) return "Protection Order";
  if (application === parentingOrderApplication) return "Parenting Order";
  if (application === "Other") return clean(otherDetails) || "other order";
  return application;
}

function withIndefiniteArticle(value: string): string {
  return `${/^[aeiou]/i.test(value) ? "an" : "a"} ${value}`;
}

export function isProtectionOrderSought(matter: MatterFile): boolean {
  return matter.intake.selectedApplications.includes(protectionOrderApplication) ||
    matter.intake.proceedingsType === "protection_order" ||
    matter.intake.proceedingsType === "both";
}

export function isParentingOrderSought(matter: MatterFile): boolean {
  return matter.intake.selectedApplications.includes(parentingOrderApplication) ||
    matter.intake.proceedingsType === "care_of_children" ||
    matter.intake.proceedingsType === "both";
}

export type StandardAffidavitContent = {
  applicationTitle: string;
  applicationIntro: string;
  relationshipStartBlurb: string;
  relationshipEnd: string;
  childrenParagraphs: string[];
  protectionFactsHeading: string[];
  withoutNoticeHeading: string[];
  withoutNoticeIntro: string[];
  withoutNoticeSafetyFactors: string[];
  parentingHeading: string[];
  parentingParagraphs: string[];
  ordersSoughtParagraphs: string[];
};

export function buildStandardAffidavitContent(matter: MatterFile): StandardAffidavitContent {
  const hasProtectionOrder = isProtectionOrderSought(matter);
  const hasParentingOrder = isParentingOrderSought(matter);
  const respondentName = clean(matter.intake.respondent.fullName).toLocaleUpperCase("en-NZ") || "the Respondent";
  const children = matter.intake.children
    .filter((child) => clean(child.fullName));
  const formattedChildNames = formatList(children.map(childFirstName)) || "the children";
  const childIsSingle = children.length === 1;
  const selectedOrderLabels = matter.intake.selectedApplications
    .map((application) => orderLabel(application, matter.intake.otherApplicationDetails))
    .filter(Boolean);
  const orderLabels = selectedOrderLabels.length
    ? selectedOrderLabels
    : [hasProtectionOrder ? "Protection Order" : "", hasParentingOrder ? "Parenting Order" : ""].filter(Boolean);
  const formattedOrders = formatList(orderLabels);
  const includeParentingProposal = hasProtectionOrder && hasParentingOrder && children.length > 0;
  const relationship = matter.intake.relationship;
  const relationshipStartBlurb = relationship.marriageOrCivilUnionDate
    ? `married${clean(relationship.marriageOrCivilUnionPlace) ? ` in ${clean(relationship.marriageOrCivilUnionPlace)}` : ""} on ${formatInputDateLong(relationship.marriageOrCivilUnionDate)}`
    : relationship.deFactoRelationshipStart
      ? `in a de facto relationship from approximately ${formatInputDateLong(relationship.deFactoRelationshipStart)}`
      : "in a family relationship";

  const applicationTitle = orderLabels.length > 1
    ? `WITHOUT NOTICE APPLICATIONS FOR ${orderLabels.map((label) => label.toUpperCase()).join(" AND ")}`
    : `WITHOUT NOTICE APPLICATION FOR ${(orderLabels[0] || "PROTECTION ORDER").toUpperCase()}`;

  const applicationIntro = orderLabels.length > 1
    ? `I am applying without notice for ${formatList(orderLabels.map(withIndefiniteArticle))} against ${respondentName} (“the Respondent”).`
    : `I am applying without notice for ${withIndefiniteArticle(orderLabels[0] || "Protection Order")} against ${respondentName} (“the Respondent”).`;

  const childrenParagraphs = children.length
    ? [`The Respondent and I are the parents of the following ${children.length === 1 ? "child" : "children"}: ${children.map(childDescription).join("; ")}.`]
    : [];

  const parentingParagraphs = includeParentingProposal
    ? [
        `I seek a Parenting Order granting me day to day care of ${formattedChildNames}. I have always had a greater role and responsibility in providing day to day care to ${formattedChildNames}. I want this arrangement to continue and for ${formattedChildNames} to remain in my day to day care.`,
        `I seek an interim Parenting Order granting the Respondent supervised contact with ${formattedChildNames}. I am concerned about ${possessive(formattedChildNames)} safety in the Respondent’s unsupervised care because:`,
        `(i)\t${formattedChildNames} ${childIsSingle ? "has" : "have"} been exposed to the Respondent’s violence towards me and ${childIsSingle ? "has" : "have"} been affected by the abuse ${childIsSingle ? "he has" : "they have"} witnessed.`,
        "(ii)\tI am concerned that the Respondent is unable to control his anger and does not realise that his behaviour is abusive.",
        `(iii)\tI want to be sure that ${formattedChildNames} ${childIsSingle ? "is" : "are"} safe and ${childIsSingle ? "is" : "are"} returned to me at the end of any contact. I am concerned that without an order the Respondent may refuse to return ${formattedChildNames}.`,
        "I propose that the contact be supervised by a Professional Contact Provider.",
      ]
    : [];

  const orders: string[] = [];
  if (hasProtectionOrder) {
    orders.push("a Protection Order against the Respondent");
  }
  if (hasParentingOrder) {
    orders.push("a Parenting Order granting me day-to-day care");
  }
  matter.intake.selectedApplications
    .filter((application) => application !== protectionOrderApplication && application !== parentingOrderApplication)
    .forEach((application) => orders.push(orderLabel(application, matter.intake.otherApplicationDetails)));
  const formattedOrderRelief = formatList(orders);
  const standardConditions = hasProtectionOrder
    ? " I seek the standard conditions of a Protection Order."
    : "";
  const requestNoun = orders.length === 1 ? "this order" : "these orders";
  const ordersSoughtParagraphs = [
    `I seek ${formattedOrderRelief || formattedOrders || "the orders set out in my application"}.${standardConditions} I respectfully request that ${requestNoun} be granted without notice to the Respondent.`,
  ];

  return {
    applicationTitle,
    applicationIntro,
    relationshipStartBlurb,
    relationshipEnd: formatInputDateLong(relationship.relationshipEndDate),
    childrenParagraphs,
    protectionFactsHeading: hasProtectionOrder
      ? ["FACTS IN SUPPORT OF APPLICATION FOR PROTECTION ORDER"]
      : [],
    withoutNoticeHeading: hasProtectionOrder
      ? ["FACTS IN SUPPORT OF APPLICATION FOR PROTECTION ORDER WITHOUT NOTICE"]
      : [],
    withoutNoticeIntro: hasProtectionOrder
      ? ["The Application for a Protection Order is being made without notice to the Respondent because the delay that would be caused by proceeding on notice would or might entail a risk of harm and undue hardship to me and the children of my family as follows:"]
      : [],
    withoutNoticeSafetyFactors: hasProtectionOrder
      ? [
          "I am very fearful for my safety and also the children’s safety.",
          "I believe that if the Respondent knew that I was applying for this Order, I may suffer further physical abuse and/or psychological abuse.",
        ]
      : [],
    parentingHeading: includeParentingProposal
      ? ["MY PROPOSAL FOR DAY TO DAY CARE AND CONTACT"]
      : [],
    parentingParagraphs,
    ordersSoughtParagraphs,
  };
}
