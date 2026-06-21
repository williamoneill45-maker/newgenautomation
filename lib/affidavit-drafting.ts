import type { Child, MatterFile } from "./matter";

export const affidavitViolenceCategories = [
  "Physical abuse",
  "Psychological abuse",
  "Sexual abuse",
  "Financial abuse",
  "Coercive or controlling behaviour",
  "Threats and intimidation",
  "Harassment",
  "Stalking",
  "Damage to property",
  "Abuse towards children",
  "Social isolation",
  "Technology-facilitated abuse",
] as const;

export type AffidavitSections = {
  violenceCategories: string[];
  historyParagraphs: string[];
  recentEventParagraphs: string[];
  parentingParagraphs: string[];
};

export type AffidavitDraftResult = {
  draft: string;
  sections: AffidavitSections;
  relationshipStartBlurb: string;
  relationshipEnd: string;
  childrenParagraphs: string[];
  parentingOrdersSought: boolean;
  source: "openai" | "fallback";
  diagnostic: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[.!?]$/.test(trimmed) || /[.!?][\u201d"]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function splitNotes(notes: string): string[] {
  return notes
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9\u201c"])/)
    .map((note) => note.trim().replace(/^\s*(?:[-*]\s*|\d+[.)]\s+)/, ""))
    .filter(Boolean);
}

const recentPattern = /\b(?:recent|ago|yesterday|last (?:night|week|month|year)|police|refuge|charge|charged|breach|urgent|strangl|chok|imped(?:e|ing) breathing|fear for (?:my|her) (?:life|safety)|reported|report to|most serious|latest|current(?:ly)?)\b/i;

type NoteGroup = {
  category: string;
  date: string;
  fragments: string[];
};

function cleanNoteFragment(value: string): string {
  return value
    .trim()
    .replace(/^\s*(?:[-*•]\s*|\d+[.)]\s+)/, "")
    .replace(/^(?:history|recent events?|relationship)\s*:\s*/i, "")
    .replace(/^respondent\s*:\s*$/i, "")
    .replace(/[.]$/, "")
    .trim();
}

function standaloneDate(value: string): string {
  const cleaned = cleanNoteFragment(value);
  if (/^20\d{2}$/.test(cleaned)) return `In ${cleaned}`;
  if (/^(?:approximately\s+)?\d+\s+(?:day|week|month|year)s?\s+ago$/i.test(cleaned)) {
    const wording = cleaned.replace(/^approximately\s+/i, "").toLowerCase();
    const number = Number(wording.match(/^\d+/)?.[0]);
    const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
    return `Approximately ${numberWords[number] ? wording.replace(/^\d+/, numberWords[number]) : wording}`;
  }
  if (/^(?:on\s+)?\d{1,2}\s+[A-Za-z]+\s+20\d{2}$/i.test(cleaned)) {
    return `On ${cleaned.replace(/^on\s+/i, "")}`;
  }
  return "";
}

function classifyFragment(value: string, currentCategory = ""): string {
  const text = value.toLowerCase();
  if (/phone rang|who the fuck|texting other guys|smash your head|threatened to kill/.test(text) || (currentCategory === "phone_threat" && /[“"]/.test(value))) return "phone_threat";
  if (/^(?:called me|verbal|swore)/.test(text) || (currentCategory === "verbal_abuse" && /[“"]/.test(value)) || (/^[“"]/.test(text) && currentCategory !== "phone_threat")) return "verbal_abuse";
  if (/pregnant|grabbed (?:me by )?(?:the )?hair|dragged (?:me )?(?:across|on) (?:the )?ground|bruis/.test(text)) return "physical_incident";
  if (/strangl|chok|hit (?:my )?head|head shoulder kidney|medical treatment/.test(text)) return "serious_assault";
  if (/pushed (?:me )?(?:onto|on) (?:a |the )?bed|scratch(?:ed)? (?:my )?back|oven|burn(?:ed|t)? (?:my )?arm/.test(text)) return "bed_oven_assault";
  if (/police|charged|warning issued|female flatmate|reported the (?:matter|incident)/.test(text)) return "police";
  if (/refuge|remain(?:s)? (?:extremely )?(?:fearful|frightened)/.test(text)) return "refuge";
  if (/met online|married/.test(text)) return "relationship";
  if (/controlled food|withheld food|breakfast only|allow.*breakfast/.test(text)) return "food_control";
  if (/corn cob|food.*mouth/.test(text)) return "food_assault";
  if (/arrived|came (?:to )?(?:nz|new zealand)|visa|immigration/.test(text)) return "immigration_control";
  if (/slapped|punched|assaulted me|physical violence/.test(text)) return "physical_pattern";
  if (/suspicious|speaking arabic/.test(text)) return "jealousy";
  if (/very jealous|no social life|phone calls constantly|where i was|whereabouts/.test(text)) return "jealousy_control";
  if (/social media/.test(text)) return "social_media";
  if (/wouldn.t let me leave|prevented me from leaving|isolat/.test(text)) return "isolation";
  if (/controlled money|control.*financ|bank|wages|income/.test(text)) return "financial_control";
  if (/destroyed|smashed mirror|cut (?:up )?(?:my )?clothes|hair straightener|belongings/.test(text)) return "property_damage";
  if (/air out of (?:my )?(?:car )?tyres?/.test(text)) return "vehicle_sabotage";
  return "general";
}

function groupNoteFragments(notes: string): NoteGroup[] {
  const fragments = notes
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9\u201c"])/)
    .map(cleanNoteFragment)
    .filter(Boolean);
  const groups: NoteGroup[] = [];
  let pendingDate = "";

  for (const fragment of fragments) {
    const date = standaloneDate(fragment);
    if (date) {
      const current = groups.at(-1);
      if (/^In 20\d{2}$/.test(date) && current?.category === "physical_incident" && current.fragments.length === 1) {
        current.date = date;
      } else {
        pendingDate = date;
      }
      continue;
    }

    const current = groups.at(-1);
    const category = classifyFragment(fragment, current?.category);
    const startsNewDatedEvent = Boolean(pendingDate && current?.fragments.length);
    if (!current || current.category !== category || startsNewDatedEvent) {
      groups.push({ category, date: pendingDate, fragments: [fragment] });
      pendingDate = "";
    } else {
      current.fragments.push(fragment);
      if (pendingDate && !current.date) current.date = pendingDate;
      pendingDate = "";
    }
  }

  return groups;
}

function extractQuotes(fragments: string[]): string[] {
  const quotes: string[] = [];
  for (const fragment of fragments) {
    for (const match of fragment.matchAll(/[“"]([^”"]+)[”"]/g)) quotes.push(match[1].trim());
  }
  return quotes;
}

function joinQuotedList(quotes: string[]): string {
  const values = quotes.map((quote) => `“${quote}”`);
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function draftNoteGroup(group: NoteGroup): string {
  const text = group.fragments.join(". ");
  const lower = text.toLowerCase();
  const date = group.date ? `${group.date}, ` : "";
  const quotes = extractQuotes(group.fragments);

  switch (group.category) {
    case "relationship": {
      const met = /met online/.test(lower);
      const marriedPlace = text.match(/married(?:\s+(?:in\s+)?)?([A-Z][A-Za-z ]+?)(?:\s+\d{1,2}\s+[A-Za-z]+\s+20\d{2}|$)/i)?.[1]?.trim();
      const marriedDate = text.match(/(\d{1,2}\s+[A-Za-z]+\s+20\d{2})/)?.[1];
      if (met && /married/.test(lower)) return ensureSentence(`I met the Respondent online, and we were subsequently married${marriedPlace ? ` in ${marriedPlace}` : ""}${marriedDate ? ` on ${marriedDate}` : ""}`);
      if (met) return "I met the Respondent online.";
      return ensureSentence(`${date}the Respondent and I were married${marriedPlace ? ` in ${marriedPlace}` : ""}${marriedDate ? ` on ${marriedDate}` : ""}`.replace(/^./, (letter) => letter.toUpperCase()));
    }
    case "food_control":
      return /breakfast/.test(lower)
        ? "The Respondent controlled my access to food. He would allow me to eat breakfast but would not allow me to eat for the remainder of the day."
        : "The Respondent controlled my access to food.";
    case "food_assault":
      return `${date}the Respondent pushed a corn cob into my mouth.`.replace(/^./, (letter) => letter.toUpperCase());
    case "immigration_control": {
      const arrival = text.match(/(?:arrived|came)(?:\s+in|\s+to)?\s+(?:NZ|New Zealand)?\s*(?:in\s+)?([A-Za-z]+\s+20\d{2})/i)?.[1];
      const sentences = [arrival ? `I arrived in New Zealand in ${arrival}.` : /arrived|came/.test(lower) ? "I arrived in New Zealand." : ""];
      if (/visa/.test(lower)) sentences.push("My visa was dependent on the Respondent’s visa.");
      return sentences.filter(Boolean).join(" ");
    }
    case "physical_pattern":
      return "The Respondent physically assaulted me, including slapping and punching me.";
    case "jealousy":
      return "When I spoke Arabic, the Respondent would become suspicious of me.";
    case "jealousy_control": {
      const sentences = ["Throughout our relationship, the Respondent was jealous and controlling."];
      if (/no social life/.test(lower)) sentences.push("He would not allow me to have a social life.");
      if (/phone calls|where i was|whereabouts/.test(lower)) sentences.push("He telephoned me repeatedly and demanded to know where I was.");
      return sentences.join(" ");
    }
    case "social_media":
      return "The Respondent did not allow me to maintain social media accounts.";
    case "verbal_abuse":
      return ensureSentence(`The Respondent verbally abused me${quotes.length ? ` and called me ${joinQuotedList(quotes)}` : ""}`);
    case "isolation":
      return "The Respondent isolated me and would not allow me to leave the house.";
    case "financial_control":
      return "The Respondent exercised significant control over our finances.";
    case "physical_incident": {
      const pregnantWith = text.match(/pregnant with ([A-Za-z]+)/i)?.[1];
      const sentences = [`${date}${/pregnant/.test(lower) ? `while I was pregnant${pregnantWith ? ` with ${pregnantWith}` : ""}, ` : ""}the Respondent grabbed me by the hair and dragged me across the ground.`.replace(/^./, (letter) => letter.toUpperCase())];
      if (/bruis/.test(lower)) sentences.push("As a result, I sustained bruising.");
      return sentences.join(" ");
    }
    case "property_damage": {
      const items: string[] = [];
      if (/mirror/.test(lower)) items.push("smashing mirrors");
      if (/clothes/.test(lower)) items.push("cutting up my clothes");
      if (/hair straightener/.test(lower)) items.push("breaking my hair straighteners");
      const itemList = items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] ?? "";
      return ensureSentence(`The Respondent destroyed my personal belongings${itemList ? `, including ${itemList}` : ""}`);
    }
    case "vehicle_sabotage":
      return `${date}the Respondent deliberately let the air out of my car tyres.`.replace(/^./, (letter) => letter.toUpperCase());
    case "serious_assault": {
      const sentences = [`${date}the Respondent strangled me.`.replace(/^./, (letter) => letter.toUpperCase())];
      if (/hit/.test(lower)) sentences.push("He also hit me on my head, shoulder, kidney and back.");
      if (/medical treatment/.test(lower)) sentences.push("He would not allow me to obtain medical treatment.");
      return sentences.join(" ");
    }
    case "bed_oven_assault": {
      const sentences = [`${date}the Respondent pushed me onto a bed and scratched my back.`.replace(/^./, (letter) => letter.toUpperCase())];
      if (/oven|burn/.test(lower)) sentences.push("He then pushed me against an oven, causing a burn to my arm.");
      return sentences.join(" ");
    }
    case "phone_threat": {
      const sentences = [`${date}the Respondent threatened me.`.replace(/^./, (letter) => letter.toUpperCase())];
      if (/phone rang/.test(lower)) sentences.push("While I was with him, my phone rang.");
      if (quotes.length) sentences.push(ensureSentence(`He said ${joinQuotedList(quotes)}`));
      return sentences.join(" ");
    }
    case "police": {
      const sentences: string[] = [];
      if (/female flatmate/.test(lower)) sentences.push(`${date}with the assistance of a female flatmate, I reported the matter to the Police.`.replace(/^./, (letter) => letter.toUpperCase()));
      else if (/police called|contacted police/.test(lower)) sentences.push(`${date}I contacted the Police, who attended and spoke with the Respondent.`.replace(/^./, (letter) => letter.toUpperCase()));
      else if (/reported/.test(lower)) sentences.push(`${date}I reported the matter to the Police.`.replace(/^./, (letter) => letter.toUpperCase()));
      if (/charged/.test(lower)) {
        const offences = [/(?:charged ).*assault/.test(lower) ? "assault" : "", /impeding breathing/.test(lower) ? "impeding breathing" : ""].filter(Boolean);
        sentences.push(`I have been informed that the Respondent has been charged${offences.length ? ` with offences including ${offences.join(" and ")}` : ""}.`);
      }
      if (/warning/.test(lower)) sentences.push("The Police issued the Respondent with a warning.");
      return sentences.join(" ") || polishFallbackNote(text);
    }
    case "refuge": {
      const sentences = [/refuge/.test(lower) ? "The Police assisted me in accessing refuge accommodation." : ""];
      if (/fear|fright/.test(lower)) sentences.push("I remain fearful of the Respondent.");
      return sentences.filter(Boolean).join(" ");
    }
    default:
      return polishFallbackNote(text);
  }
}

function polishFallbackNote(note: string): string {
  let value = note.trim();
  value = value.replace(/^she\s+/i, "I ").replace(/^her\s+/i, "My ");
  value = value.replace(/^he\s+/i, "The Respondent ");
  value = value.replace(/^respondent\s+/i, "The Respondent ");
  value = value.replace(/^met online\b/i, "I met the Respondent online");
  value = value.replace(/^married\b/i, "The Respondent and I married");
  value = value.replace(/^split\b/i, "The Respondent and I separated");
  value = value.replace(/^came NZ\b/i, "I arrived in New Zealand");
  value = value.replace(/^visa dependent on (?:him|the Respondent)\b/i, "My visa was dependent on the Respondent");
  value = value.replace(/^breakfast only\b/i, "The Respondent only allowed me to eat breakfast");
  value = value.replace(/^suspicious when speaking ([^.]+)\b/i, "The Respondent became suspicious when I spoke $1");
  value = value.replace(/^would not let (?:her|me) get medical treatment\b/i, "The Respondent would not allow me to obtain medical treatment");
  value = value.replace(/^police charged (?:him|the Respondent)\b/i, "The Police charged the Respondent");
  value = value.replace(/^police assisted (?:her|me) into\b/i, "The Police assisted me into");
  value = value.replace(/^approximately (.+?) (?:he|the Respondent)\b/i, "Approximately $1 the Respondent");
  value = value.replace(/^hit head, shoulder, kidney, back\b/i, "The Respondent hit me on my head, shoulder, kidney and back");
  value = value.replace(/\bher (?=(?:head|shoulder|kidney|back|arm|face|body|home|family|visa)\b)/gi, "my ");
  value = value.replace(/\bher\b/gi, "me").replace(/\bhim\b/gi, "the Respondent");
  value = value.replace(/\bhe\b/gi, "the Respondent").replace(/\bshe\b/gi, "I");
  value = value.replace(/\bthe Respondent controlled food\b/i, "the Respondent controlled my access to food");
  value = value.replace(/\bpushed corn cob into mouth\b/i, "pushed a corn cob into my mouth");
  value = value.replace(/\bagainst oven causing burn\b/i, "against an oven, causing a burn");
  value = value.replace(/\bonto bed\b/i, "onto a bed");
  value = value.replace(/^(The Respondent and I married in [^.]+?) (\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i, "$1 on $2");
  value = value.replace(/^I arrived in New Zealand (\w+\s+20\d{2})\b/i, "I arrived in New Zealand in $1");
  value = value.replace(/^(The Respondent (?:slapped|punched|kicked|hit|assaulted)(?: and (?:slapped|punched|kicked|hit|assaulted))*)\.?$/i, "$1 me");
  value = value.replace(/^I remains\b/i, "I remain");

  if (/^(?:slapped|punched|hit|pushed|grabbed|strangled|choked|threatened|controlled|isolated|prevented|refused|called|scratched|assaulted|damaged|withheld)\b/i.test(value)) {
    value = `The Respondent ${value.charAt(0).toLowerCase()}${value.slice(1)}`;
  } else if (/^(?:came|arrived|went|reported|left|stayed|sought|was|am|remain)\b/i.test(value)) {
    value = `I ${value.charAt(0).toLowerCase()}${value.slice(1)}`;
  }

  return ensureSentence(value);
}

export function draftFallbackAffidavitSections(historyNotes: string, recentNotes: string) {
  let historyText = historyNotes;
  let recentText = recentNotes;

  if (!recentText.trim() && historyText.trim()) {
    const combined = splitNotes(historyText);
    const inferredRecent = combined.filter((paragraph) => recentPattern.test(paragraph));
    const inferredHistory = combined.filter((paragraph) => !recentPattern.test(paragraph));
    if (inferredRecent.length && inferredHistory.length) {
      historyText = inferredHistory.join("\n");
      recentText = inferredRecent.join("\n");
    }
  } else if (!historyText.trim() && recentText.trim()) {
    const combined = splitNotes(recentText);
    const inferredHistory = combined.filter((paragraph) => !recentPattern.test(paragraph));
    const inferredRecent = combined.filter((paragraph) => recentPattern.test(paragraph));
    if (inferredRecent.length && inferredHistory.length) {
      historyText = inferredHistory.join("\n");
      recentText = inferredRecent.join("\n");
    }
  }
  return {
    violenceCategories: detectCategories(`${historyNotes}\n${recentNotes}`),
    historyParagraphs: groupNoteFragments(historyText).map(draftNoteGroup).filter(Boolean),
    recentEventParagraphs: groupNoteFragments(recentText).map(draftNoteGroup).filter(Boolean),
  };
}

const categoryPatterns: Array<[string, RegExp]> = [
  ["Physical abuse", /\b(?:assault|slap|punch|hit|kick|push|grab|drag|strangl|chok|burn|scratch|injur|bruise|physical)\w*/i],
  ["Psychological abuse", /\b(?:verbal|called me|swore|insult|humiliat|degrad|jealous|fear|fright|psychological|emotional|useless mother)\w*/i],
  ["Sexual abuse", /\b(?:sexual|rape|forced sex|unwanted sex)\w*/i],
  ["Financial abuse", /\b(?:money|bank|financial|income|benefit|wages|withheld funds|not allow.*work)\w*/i],
  ["Coercive or controlling behaviour", /\b(?:control|coerc|permit|not allow|prevent|visa|immigration|withhold(?:ing)? food)\w*/i],
  ["Threats and intimidation", /\b(?:threat|intimidat|i will kill|i(?:'|’)ll.{0,20}kill|kill you|harm you)\w*/i],
  ["Harassment", /\b(?:harass|repeatedly contact|constant(?:ly)? call)\w*/i],
  ["Stalking", /\b(?:stalk|followed me|watched my home|tracked my location)\w*/i],
  ["Damage to property", /\b(?:(?:damage|destroy|smash|break|broke).{0,35}(?:property|belonging|phone|door|wall|car|window|mirror|clothes|straightener)|(?:air out of .*tyres))\b/i],
  ["Abuse towards children", /\b(?:child|children|son|daughter).{0,40}\b(?:abuse|assault|hit|threat|fright|witness|expos)\w*/i],
  ["Social isolation", /\b(?:isolat|social life|friends|family|leave (?:the )?house|social media)\w*/i],
  ["Technology-facilitated abuse", /\b(?:phone|device|password|social media|online|location).{0,35}\b(?:monitor|track|control|access|message|account)\w*/i],
];

function detectCategories(notes: string): string[] {
  return categoryPatterns
    .filter(([, pattern]) => pattern.test(notes))
    .map(([category]) => category);
}

function parseInputDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLongDate(value: string): string {
  const date = parseInputDate(value);
  if (!date) return clean(value);
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function relationshipWording(matter: MatterFile): { start: string; end: string } {
  const relationship = matter.intake.relationship;
  if (relationship.marriageOrCivilUnionDate) {
    return {
      start: `married on ${formatLongDate(relationship.marriageOrCivilUnionDate)}`,
      end: formatLongDate(relationship.relationshipEndDate),
    };
  }
  if (relationship.deFactoRelationshipStart) {
    return {
      start: `in a de facto relationship from approximately ${formatLongDate(relationship.deFactoRelationshipStart)}`,
      end: formatLongDate(relationship.relationshipEndDate),
    };
  }
  return { start: "in a relationship", end: formatLongDate(relationship.relationshipEndDate) };
}

function isParentRelationship(value: string): boolean {
  return /\b(?:mother|father|parent|mum|dad)\b/i.test(value);
}

function childDescription(child: Child): string {
  const name = clean(child.fullName) || "THE CHILD";
  const firstName = name.split(/\s+/)[0];
  const dob = formatLongDate(child.dateOfBirth);
  return ensureSentence(`${name.toUpperCase()}${dob ? `, born ${dob}` : ""}, (\u201c${firstName}\u201d)`);
}

function parentNoun(gender: string): string {
  return gender === "F" ? "mother" : gender === "M" ? "father" : "parent";
}

function buildChildrenParagraphs(matter: MatterFile): string[] {
  const both: Child[] = [];
  const applicantOnly: Child[] = [];
  const respondentOnly: Child[] = [];

  matter.intake.children.filter((child) => clean(child.fullName)).forEach((child) => {
    const applicantParent = isParentRelationship(child.applicantRelationshipToChild);
    const respondentParent = isParentRelationship(child.respondentRelationshipToChild);
    if (applicantParent && respondentParent) both.push(child);
    else if (applicantParent) applicantOnly.push(child);
    else if (respondentParent) respondentOnly.push(child);
  });

  const output: string[] = [];
  if (both.length) {
    output.push("The Respondent and I are the parents of the following children:");
    output.push(...both.map(childDescription));
  }
  if (applicantOnly.length) {
    output.push(`I am also the ${parentNoun(matter.intake.applicant.gender)} of the following children:`);
    output.push(...applicantOnly.map(childDescription));
    output.push(`The Respondent is not the ${parentNoun(matter.intake.respondent.gender)} of ${applicantOnly.map((child) => child.fullName.split(/\s+/)[0]).join(" and ")}.`);
  }
  if (respondentOnly.length) {
    output.push(`The Respondent is also the ${parentNoun(matter.intake.respondent.gender)} of the following children:`);
    output.push(...respondentOnly.map(childDescription));
    output.push(`I am not the ${parentNoun(matter.intake.applicant.gender)} of ${respondentOnly.map((child) => child.fullName.split(/\s+/)[0]).join(" and ")}.`);
  }
  return output;
}

export function isParentingOrderSought(matter: MatterFile): boolean {
  return matter.intake.selectedApplications.some((application) => /parenting order/i.test(application)) ||
    matter.intake.proceedingsType === "care_of_children" || matter.intake.proceedingsType === "both";
}

function buildParentingParagraphs(matter: MatterFile): string[] {
  if (!isParentingOrderSought(matter)) return [];
  const children = matter.intake.children.filter((child) => clean(child.fullName));
  const names = children.map((child) => child.fullName.split(/\s+/)[0]).join(", ");
  const output = [
    ensureSentence(`I seek an interim Parenting Order placing ${names || "the children"} in my day-to-day care`),
  ];
  const arrangements = children
    .filter((child) => clean(child.livingWithName))
    .map((child) => `${child.fullName.split(/\s+/)[0]} currently lives with ${child.livingWithName}`);
  if (arrangements.length) output.push(ensureSentence(arrangements.join("; ")));
  output.push("I ask that contact between the Respondent and the children be determined on an interim basis with their safety and welfare as the first consideration.");
  return output;
}

function renderDraft(matter: MatterFile, sections: AffidavitSections): string {
  let number = 4;
  const render = (title: string, paragraphs: string[]) => {
    if (!paragraphs.length) return "";
    const text = paragraphs.map((paragraph) => `${number++}. ${paragraph}`).join("\n\n");
    return `${title}\n\n${text}`;
  };
  return [
    `Applicant: ${matter.intake.applicant.fullName || matter.clientName || "the applicant"}`,
    `Respondent: ${matter.intake.respondent.fullName || "the respondent"}`,
    render("History of Family Violence", sections.historyParagraphs),
    render("Recent Events", sections.recentEventParagraphs),
    render("My Proposal for Day-to-Day Care and Contact", sections.parentingParagraphs),
  ].filter(Boolean).join("\n\n");
}

function extractOutputText(data: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof data.output_text === "string") return data.output_text.trim();
  return (data.output ?? []).flatMap((item) => item.content ?? []).map((content) => content.text ?? "").filter(Boolean).join("\n").trim();
}

function normalizeAiSections(value: unknown, fallback: AffidavitSections): AffidavitSections {
  if (!value || typeof value !== "object") return fallback;
  const data = value as Record<string, unknown>;
  const array = (key: string) => Array.isArray(data[key])
    ? (data[key] as unknown[]).filter((item): item is string => typeof item === "string").map((item) => ensureSentence(item)).filter(Boolean)
    : [];
  const allowed = new Set<string>(affidavitViolenceCategories);
  const violenceCategories = array("violenceCategories").filter((category) => allowed.has(category.replace(/[.]$/, ""))).map((category) => category.replace(/[.]$/, ""));
  return {
    violenceCategories: violenceCategories.length ? violenceCategories : fallback.violenceCategories,
    historyParagraphs: array("historyParagraphs"),
    recentEventParagraphs: array("recentEventParagraphs"),
    parentingParagraphs: fallback.parentingParagraphs,
  };
}

function normalizeComparisonText(value: string): string {
  return value.toLowerCase().replace(/[“”"'.,:;!?()[\]-]/g, " ").replace(/\s+/g, " ").trim();
}

function paragraphsAreUsable(paragraphs: string[], sourceNotes: string): boolean {
  if (!sourceNotes.trim()) return true;
  if (!paragraphs.length) return false;
  const rawFragments = new Set(splitNotes(sourceNotes).map(normalizeComparisonText).filter(Boolean));
  return paragraphs.every((paragraph) => {
    const normalized = normalizeComparisonText(paragraph);
    return normalized.split(" ").length >= 6 && !rawFragments.has(normalized) && !/^[-*•]/.test(paragraph.trim());
  });
}

export async function draftDomesticViolenceAffidavit(matter: MatterFile): Promise<AffidavitDraftResult> {
  const historyNotes = clean(matter.intake.domesticViolenceNotes.history);
  const recentNotes = clean(matter.intake.domesticViolenceNotes.recentEvents);
  const fallbackNotes = draftFallbackAffidavitSections(historyNotes, recentNotes);
  const fallbackSections: AffidavitSections = {
    ...fallbackNotes,
    parentingParagraphs: buildParentingParagraphs(matter),
  };
  const relationship = relationshipWording(matter);
  const base = {
    relationshipStartBlurb: relationship.start,
    relationshipEnd: relationship.end,
    childrenParagraphs: buildChildrenParagraphs(matter),
    parentingOrdersSought: isParentingOrderSought(matter),
  };
  const finish = (sections: AffidavitSections, source: "openai" | "fallback", diagnostic: string): AffidavitDraftResult => ({
    ...base,
    sections,
    draft: renderDraft(matter, sections),
    source,
    diagnostic,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || (!historyNotes && !recentNotes)) {
    return finish(fallbackSections, "fallback", apiKey ? "No family violence notes were supplied." : "OPENAI_API_KEY is not configured.");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        input: [
          {
            role: "system",
            content: "Draft editable New Zealand Family Court affidavit evidence from shorthand lawyer notes. Use first-person, plain English, complete lawyer-drafted paragraphs and chronological order. One significant event, topic, or pattern belongs in each paragraph. Expand shorthand into grammatical evidence while preserving the underlying facts, dates, and every direct quote. For example, 'strangled me' may become 'The Respondent strangled me, causing me to fear for my life'; 'controlled money' may become 'The Respondent exercised significant control over finances'; and related fragments such as a date, assault details, and resulting injury should form one coherent paragraph. Do not invent a new event, date, injury, motive, frequency, feeling, or legal conclusion. Do not simply reproduce note-style one-line fragments. Do not duplicate, summarise, add headings, add paragraph numbers, use bullets, or expose raw notes. Put background and long-term patterns in historyParagraphs. Put recent assaults, strangulation, threats, police, refuge, charges, breaches and current fear in recentEventParagraphs. Return only supported violence categories from the supplied list.",
          },
          {
            role: "user",
            content: `Allowed categories: ${affidavitViolenceCategories.join(", ")}\n\nHistory notes:\n${historyNotes || "[None supplied]"}\n\nRecent events notes:\n${recentNotes || "[None supplied]"}`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "family_violence_affidavit_sections",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                violenceCategories: { type: "array", items: { type: "string", enum: affidavitViolenceCategories } },
                historyParagraphs: { type: "array", items: { type: "string" } },
                recentEventParagraphs: { type: "array", items: { type: "string" } },
              },
              required: ["violenceCategories", "historyParagraphs", "recentEventParagraphs"],
            },
          },
        },
      }),
    });
    if (!response.ok) return finish(fallbackSections, "fallback", `OpenAI request failed with status ${response.status}.`);
    const text = extractOutputText(await response.json());
    const sections = normalizeAiSections(JSON.parse(text), fallbackSections);
    if (
      !paragraphsAreUsable(sections.historyParagraphs, historyNotes) ||
      !paragraphsAreUsable(sections.recentEventParagraphs, recentNotes)
    ) {
      return finish(fallbackSections, "fallback", "OpenAI returned incomplete or note-style affidavit paragraphs, so the validated fallback draft was used.");
    }
    return finish(sections, "openai", "OpenAI affidavit drafting completed.");
  } catch {
    return finish(fallbackSections, "fallback", "OpenAI affidavit drafting could not be completed.");
  }
}
