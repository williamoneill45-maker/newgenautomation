import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DraftAffidavitRequest = {
  applicantName?: string;
  respondentName?: string;
  selectedOrders?: string[];
  ordersSought?: string;
  protectedPersons?: string;
  protectionOrderFacts?: string;
  parentingProposal?: string;
  preventingRemovalFacts?: string;
  tenancyOrderFacts?: string;
  warrantFacts?: string;
  additionalGuardianFacts?: string;
  historyNotes?: string;
  recentEventsNotes?: string;
  children?: Array<{
    fullName?: string;
    age?: string;
    dateOfBirth?: string;
    applicantRelationshipToChild?: string;
    respondentRelationshipToChild?: string;
    livingWithName?: string;
  }>;
};

type OpenAITextContent = {
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAITextContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

type AffidavitDiagnostic = {
  level: "info" | "warning" | "error";
  message: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractOutputText(data: OpenAIResponse): string {
  if (typeof data.output_text === "string") {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  return data.output
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function splitNotes(notes: string): string[] {
  return notes
    .split(/\n{2,}|\n(?=\s*(?:[-*•]|\d+[.)])\s+)/)
    .map((note) => note.trim())
    .map((note) => note.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""))
    .map((note) => note.replace(/\s+/g, " "))
    .filter(Boolean);
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function polishAffidavitNote(note: string): string {
  const trimmed = note.trim();

  if (!trimmed) {
    return "";
  }

  const fragments = trimmed
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .map((fragment) => {
      const sentence = fragment
        .replace(/^(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(.+)/, "On $1, $2")
        .replace(/^(\d{4})\s+(.+)/, "In $1, $2")
        .replace(/^(In \d{4}, )(?=moved|immigrated|went|reported|called|left|arrived|started|got|signed)\b/i, "$1I ")
        .replace(/^(On \d{1,2}\s+[A-Za-z]+\s+\d{4}, )(?=went|reported|called|left|arrived|woke|said|told|asked)\b/i, "$1I ")
        .replace(/\bRespondent\b/g, "the Respondent")
        .replace(/^the Respondent\b/, "The Respondent")
        .replace(/^respondent\b/i, "The Respondent")
        .replace(/^he\b/i, "The Respondent")
        .replace(/^she\b/i, "The Respondent")
        .replace(/^children saw it\.?$/i, "The children witnessed this")
        .replace(/^children saw this\.?$/i, "The children witnessed this")
        .replace(/^bruising\.?$/i, "This caused bruising")
        .replace(/^police took statement\.?$/i, "The Police took a statement")
        .replace(
          /^exhibit\s+([A-Z])\s+photos\.?$/i,
          (_match, exhibit: string) => `I refer to the photographs at Exhibit "${exhibit.toUpperCase()}"`,
        );

      return ensureSentence(sentence);
    });

  return fragments.join(" ");
}

function buildNumberedSection(
  title: string,
  notes: string,
  startNumber: number,
): { text: string; nextNumber: number } {
  const paragraphs = splitNotes(notes);

  if (paragraphs.length === 0) {
    return { text: "", nextNumber: startNumber };
  }

  const text = [
    title,
    "",
    ...paragraphs.flatMap((paragraph, index) => [
      `${startNumber + index}. ${polishAffidavitNote(paragraph)}`,
      "",
    ]),
  ]
    .join("\n")
    .trim();

  return { text, nextNumber: startNumber + paragraphs.length };
}

function buildFallbackDraft({
  applicantName,
  respondentName,
  selectedOrders,
  ordersSought,
  protectedPersons,
  protectionOrderFacts,
  parentingProposal,
  preventingRemovalFacts,
  tenancyOrderFacts,
  warrantFacts,
  additionalGuardianFacts,
  historyNotes,
  recentEventsNotes,
}: Required<DraftAffidavitRequest>): string {
  const history = buildNumberedSection("History of Family Violence", historyNotes, 4);
  const recentEvents = buildNumberedSection(
    "Recent Events",
    recentEventsNotes,
    Math.max(history.nextNumber, 26),
  );
  const ordersText = ensureSentence(ordersSought || selectedOrders.join(", "));

  return [
    ordersText ? `Orders Sought\n\n${ordersText}` : "",
    protectedPersons ? `Protected Persons\n\n${ensureSentence(protectedPersons)}` : "",
    protectionOrderFacts
      ? `Facts in Support of Protection Order\n\n${ensureSentence(protectionOrderFacts)}`
      : "",
    parentingProposal ? `Parenting Proposal\n\n${ensureSentence(parentingProposal)}` : "",
    preventingRemovalFacts
      ? `Facts in Support of Order Preventing Removal from New Zealand\n\n${ensureSentence(preventingRemovalFacts)}`
      : "",
    tenancyOrderFacts
      ? `Facts in Support of Tenancy Order\n\n${ensureSentence(tenancyOrderFacts)}`
      : "",
    warrantFacts ? `Facts in Support of Warrant\n\n${ensureSentence(warrantFacts)}` : "",
    additionalGuardianFacts
      ? `Facts in Support of Additional Guardian Order\n\n${ensureSentence(additionalGuardianFacts)}`
      : "",
    `Applicant: ${applicantName}`,
    `Respondent: ${respondentName}`,
    history.text,
    recentEvents.text,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as DraftAffidavitRequest;
  const applicantName = cleanText(body.applicantName) || "the applicant";
  const respondentName = cleanText(body.respondentName) || "the respondent";
  const selectedOrders = Array.isArray(body.selectedOrders)
    ? body.selectedOrders.map(cleanText).filter(Boolean)
    : [];
  const ordersSought = cleanText(body.ordersSought);
  const protectedPersons = cleanText(body.protectedPersons);
  const protectionOrderFacts = cleanText(body.protectionOrderFacts);
  const parentingProposal = cleanText(body.parentingProposal);
  const preventingRemovalFacts = cleanText(body.preventingRemovalFacts);
  const tenancyOrderFacts = cleanText(body.tenancyOrderFacts);
  const warrantFacts = cleanText(body.warrantFacts);
  const additionalGuardianFacts = cleanText(body.additionalGuardianFacts);
  const historyNotes = cleanText(body.historyNotes);
  const recentEventsNotes = cleanText(body.recentEventsNotes);
  const children = Array.isArray(body.children) ? body.children : [];

  if (
    selectedOrders.length === 0 &&
    !ordersSought &&
    !protectedPersons &&
    !protectionOrderFacts &&
    !parentingProposal &&
    !preventingRemovalFacts &&
    !tenancyOrderFacts &&
    !warrantFacts &&
    !additionalGuardianFacts &&
    !historyNotes &&
    !recentEventsNotes
  ) {
    return NextResponse.json({ draft: "" });
  }

  const fallbackDraft = buildFallbackDraft({
    applicantName,
    respondentName,
    selectedOrders,
    ordersSought,
    protectedPersons,
    protectionOrderFacts,
    parentingProposal,
    preventingRemovalFacts,
    tenancyOrderFacts,
    warrantFacts,
    additionalGuardianFacts,
    historyNotes,
    recentEventsNotes,
    children,
  });
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      draft: fallbackDraft,
      source: "fallback",
      diagnostics: [
        {
          level: "error",
          message: "OPENAI_API_KEY is not configured, so the affidavit workbench is using the basic structured fallback.",
        },
      ] satisfies AffidavitDiagnostic[],
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        input: [
          {
            role: "system",
            content: [
              "You draft New Zealand Family Court affidavit wording for a lawyer.",
              "Use only the supplied notes. Do not invent facts, dates, injuries, witnesses, exhibits, allegations, legal conclusions, or safety concerns.",
              "Turn shorthand lawyer intake notes into polished affidavit paragraphs in the applicant's first person voice, using formal New Zealand Family Court affidavit style.",
              "Refer to the other party as 'the Respondent' after the first mention unless the notes clearly require otherwise.",
              "Keep wording factual, chronological, specific, and suitable for lawyer review, similar to a protection order affidavit with separate paragraphs for each incident, pattern of control, threat, assault, sexual violence allegation, financial abuse allegation, monitoring, police report, medical report, or child-witness issue.",
              "Write in the applicant's voice as evidence, for example: 'In 2021, the Respondent...' or 'On 5 February 2021, the Respondent...'.",
              "Where notes describe patterns, create concise pattern paragraphs; where notes describe specific incidents, create one numbered paragraph per incident.",
              "If children witnessed abuse and children are supplied, identify them by first name only unless the notes use their full name.",
              "You may correct shorthand grammar and convert note fragments into complete sentences, but you must not add facts that are not clearly supplied.",
              "Do not include advice, commentary, summaries, caveats, or markdown formatting.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Applicant: ${applicantName}`,
              `Respondent: ${respondentName}`,
              `Selected orders / sections: ${selectedOrders.join(", ") || "[None selected]"}`,
              "",
              "Children:",
              children.length
                ? children
                    .map(
                      (child, index) =>
                        `${index + 1}. ${cleanText(child.fullName) || "[Unnamed child]"}; age ${cleanText(child.age) || "[not supplied]"}; dob ${cleanText(child.dateOfBirth) || "[not supplied]"}; applicant relationship ${cleanText(child.applicantRelationshipToChild) || "[not supplied]"}; respondent relationship ${cleanText(child.respondentRelationshipToChild) || "[not supplied]"}; living with ${cleanText(child.livingWithName) || "[not supplied]"}`,
                    )
                    .join("\n")
                : "[No children supplied]",
              "",
              "Draft only the sections supported by the selected orders and supplied notes.",
              "Use these headings where the matching notes or selected orders require them:",
              "Orders Sought",
              "Protected Persons",
              "Facts in Support of Protection Order",
              "Parenting Proposal",
              "Facts in Support of Order Preventing Removal from New Zealand",
              "Facts in Support of Tenancy Order",
              "Facts in Support of Warrant",
              "Facts in Support of Additional Guardian Order",
              "History of Family Violence",
              "Recent Events",
              "",
              "Formatting requirements:",
              "- Put the paragraph number and paragraph text on the same line, for example: 4. During the relationship, the Respondent...",
              "- Start History of Family Violence at paragraph 4.",
              "- Start Recent Events at paragraph 26 unless the history section needs more paragraphs; if so, continue numbering sequentially.",
              "- Split different incidents into separate numbered paragraphs.",
              "- Use a polished affidavit style like: 'During our relationship, the Respondent pushed me on multiple occasions against objects including the kitchen bench...' where the supplied notes support that detail.",
              "- Do not merely repeat raw notes. Convert them into complete affidavit paragraphs.",
              "- Preserve dates, places, quotes, names, and exhibit references only where they are supplied in the notes.",
              "- Do not add sections that are not selected or not supported by the supplied notes.",
              "- Do not add a safety concerns section.",
              "",
              "Orders sought notes:",
              ordersSought || "[No orders sought notes supplied]",
              "",
              "Protected persons notes:",
              protectedPersons || "[No protected persons notes supplied]",
              "",
              "Protection order facts:",
              protectionOrderFacts || "[No protection order facts supplied]",
              "",
              "Parenting proposal notes:",
              parentingProposal || "[No parenting proposal supplied]",
              "",
              "Preventing removal facts:",
              preventingRemovalFacts || "[No preventing removal facts supplied]",
              "",
              "Tenancy order facts:",
              tenancyOrderFacts || "[No tenancy order facts supplied]",
              "",
              "Warrant facts:",
              warrantFacts || "[No warrant facts supplied]",
              "",
              "Additional guardian facts:",
              additionalGuardianFacts || "[No additional guardian facts supplied]",
              "",
              "History notes:",
              historyNotes || "[No history notes supplied]",
              "",
              "Recent events notes:",
              recentEventsNotes || "[No recent events notes supplied]",
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        draft: fallbackDraft,
        source: "fallback",
        diagnostics: [
          {
            level: "error",
            message: `OpenAI affidavit drafting failed with status ${response.status}. Check the API key, model, and Vercel environment variables.`,
          },
        ] satisfies AffidavitDiagnostic[],
      });
    }

    const data = (await response.json()) as OpenAIResponse;
    const draft = extractOutputText(data);
    return NextResponse.json({
      draft: draft || fallbackDraft,
      source: draft ? "openai" : "fallback",
      diagnostics: draft
        ? [
            {
              level: "info",
              message: "OpenAI affidavit drafting completed. Review all wording before filing.",
            },
          ]
        : [
            {
              level: "warning",
              message: "OpenAI returned an empty affidavit draft, so the workbench used the basic structured fallback.",
            },
          ],
    });
  } catch {
    return NextResponse.json({
      draft: fallbackDraft,
      source: "fallback",
      diagnostics: [
        {
          level: "error",
          message: "OpenAI affidavit drafting could not be reached. Check network access and Vercel function logs.",
        },
      ] satisfies AffidavitDiagnostic[],
    });
  }
}
