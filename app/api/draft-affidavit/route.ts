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

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as DraftAffidavitRequest;
  const applicantName = cleanText(body.applicantName) || "the applicant";
  const respondentName = cleanText(body.respondentName) || "the respondent";
  const historyNotes = cleanText(body.historyNotes);
  const recentEventsNotes = cleanText(body.recentEventsNotes);

  if (!historyNotes && !recentEventsNotes) {
    return NextResponse.json({ draft: "" });
  }

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
          content:
            "You draft neutral New Zealand Family Court affidavit wording for a lawyer. Use only the supplied notes. Do not invent facts, dates, injuries, allegations, legal conclusions, or safety concerns. Keep the draft factual, chronological, and suitable for later lawyer review.",
        },
        {
          role: "user",
          content: [
            `Applicant: ${applicantName}`,
            `Respondent: ${respondentName}`,
            "",
            "Draft only these two affidavit sections:",
            "1. History of domestic violence",
            "2. Recent events",
            "",
            "Use first person where appropriate. If a detail is unclear, preserve the lawyer's wording instead of guessing. Do not add a safety concerns section.",
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
    const detail = await response.text();
    return NextResponse.json(
      { error: "Affidavit drafting failed.", detail },
      { status: 502 },
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  return NextResponse.json({ draft: extractOutputText(data) });
}
