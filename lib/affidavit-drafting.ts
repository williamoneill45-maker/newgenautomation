import type { MatterFile } from "./matter";

export type AffidavitDraftResult = {
  draft: string;
  source: "openai" | "fallback";
  diagnostic: string;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitNotes(notes: string): string[] {
  return notes
    .split(/\n{2,}|\n(?=\s*(?:[-*]|\d+[.)])\s+)/)
    .map((note) => note.trim().replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""))
    .filter(Boolean);
}

function ensureSentence(value: string): string {
  return /[.!?"]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;
}

function fallbackSection(title: string, notes: string, start: number) {
  const paragraphs = splitNotes(notes);
  if (!paragraphs.length) return { text: "", next: start };

  return {
    text: [
      title,
      "",
      ...paragraphs.flatMap((paragraph, index) => [
        `${start + index}. ${ensureSentence(paragraph)}`,
        "",
      ]),
    ].join("\n").trim(),
    next: start + paragraphs.length,
  };
}

function fallbackDraft(matter: MatterFile): string {
  const history = fallbackSection("History of Family Violence", matter.intake.domesticViolenceNotes.history, 4);
  const recent = fallbackSection("Recent Events", matter.intake.domesticViolenceNotes.recentEvents, Math.max(history.next, 26));

  return [
    `Applicant: ${matter.intake.applicant.fullName || matter.clientName || "the applicant"}`,
    `Respondent: ${matter.intake.respondent.fullName || "the respondent"}`,
    history.text,
    recent.text,
  ].filter(Boolean).join("\n\n");
}

function extractOutputText(data: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof data.output_text === "string") return data.output_text.trim();

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function draftDomesticViolenceAffidavit(matter: MatterFile): Promise<AffidavitDraftResult> {
  const fallback = fallbackDraft(matter);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      draft: fallback,
      source: "fallback",
      diagnostic: "OPENAI_API_KEY is not configured.",
    };
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
              "Draft New Zealand Family Court domestic violence affidavit wording for lawyer review.",
              "Use first person applicant voice, numbered paragraphs, and formal affidavit style.",
              "Use only supplied notes. Do not invent facts, dates, injuries, witnesses, exhibits, or legal conclusions.",
              "Split separate incidents, patterns of control, threats, assaults, child-witness issues, police reports, medical reports, and exhibits into separate paragraphs.",
              "Use headings History of Family Violence and Recent Events.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `Applicant: ${clean(matter.intake.applicant.fullName) || clean(matter.clientName) || "the applicant"}`,
              `Respondent: ${clean(matter.intake.respondent.fullName) || "the respondent"}`,
              `Applications: ${matter.intake.selectedApplications.join(", ") || "Not supplied"}`,
              "",
              "History notes:",
              matter.intake.domesticViolenceNotes.history || "[None]",
              "",
              "Recent events notes:",
              matter.intake.domesticViolenceNotes.recentEvents || "[None]",
              "",
              "Start History of Family Violence at paragraph 4. Start Recent Events at paragraph 26 unless numbering must continue sequentially.",
            ].join("\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        draft: fallback,
        source: "fallback",
        diagnostic: `OpenAI request failed with status ${response.status}.`,
      };
    }

    const draft = extractOutputText(await response.json());
    return {
      draft: draft || fallback,
      source: draft ? "openai" : "fallback",
      diagnostic: draft ? "OpenAI affidavit drafting completed." : "OpenAI returned an empty response.",
    };
  } catch {
    return {
      draft: fallback,
      source: "fallback",
      diagnostic: "OpenAI affidavit drafting could not be reached.",
    };
  }
}
