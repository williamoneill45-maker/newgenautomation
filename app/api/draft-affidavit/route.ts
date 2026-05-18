import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DraftAffidavitRequest = {
  applicantName?: string;
  respondentName?: string;
  historyNotes?: string;
  recentEventsNotes?: string;
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
    .split(/\n+/)
    .map((note) => note.trim())
    .filter(Boolean);
}

function buildNumberedSection(title: string, notes: string, startNumber: number): string {
  const paragraphs = splitNotes(notes);

  if (paragraphs.length === 0) {
    return "";
  }

  return [
    title,
    "",
    ...paragraphs.flatMap((paragraph, index) => [
      String(startNumber + index),
      paragraph,
      "",
    ]),
  ]
    .join("\n")
    .trim();
}

function buildFallbackDraft({
  historyNotes,
  recentEventsNotes,
}: Required<DraftAffidavitRequest>): string {
  return [
    buildNumberedSection("History of Family Violence", historyNotes, 4),
    buildNumberedSection("Recent Events", recentEventsNotes, 26),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as DraftAffidavitRequest;
  const applicantName = cleanText(body.applicantName) || "the applicant";
  const respondentName = cleanText(body.respondentName) || "the respondent";
  const historyNotes = cleanText(body.historyNotes);
  const recentEventsNotes = cleanText(body.recentEventsNotes);

  if (!historyNotes && !recentEventsNotes) {
    return NextResponse.json({ draft: "" });
  }

  const fallbackDraft = buildFallbackDraft({
    applicantName,
    respondentName,
    historyNotes,
    recentEventsNotes,
  });
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ draft: fallbackDraft, source: "fallback" });
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
              "Draft in the applicant's first person voice, using formal affidavit style.",
              "Refer to the other party as 'the Respondent' after the first mention unless the notes clearly require otherwise.",
              "Keep wording factual, chronological, specific, and suitable for lawyer review.",
              "Do not include advice, commentary, summaries, caveats, or markdown formatting.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Applicant: ${applicantName}`,
              `Respondent: ${respondentName}`,
              "",
              "Draft exactly two sections with these headings:",
              "History of Family Violence",
              "Recent Events",
              "",
              "Formatting requirements:",
              "- Number each affidavit paragraph on its own line before the paragraph text.",
              "- Start History of Family Violence at paragraph 4.",
              "- Start Recent Events at paragraph 26 unless the history section needs more paragraphs; if so, continue numbering sequentially.",
              "- Split different incidents into separate numbered paragraphs.",
              "- Preserve dates, places, quotes, names, and exhibit references only where they are supplied in the notes.",
              "- Do not add a safety concerns section.",
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
      return NextResponse.json({ draft: fallbackDraft, source: "fallback" });
    }

    const data = (await response.json()) as OpenAIResponse;
    const draft = extractOutputText(data);
    return NextResponse.json({ draft: draft || fallbackDraft, source: draft ? "openai" : "fallback" });
  } catch {
    return NextResponse.json({ draft: fallbackDraft, source: "fallback" });
  }
}
