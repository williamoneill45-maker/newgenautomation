import { NextResponse } from "next/server";

import type { MatterFile } from "../../../../lib/matter";
import {
  generateStudioDocxPreview,
  getStudioTemplate,
  templateAppliesToMatter,
} from "../../../../lib/template-studio";

export const runtime = "nodejs";

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim().replace(/\s+/g, "_") || "Template_Test";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      studioId?: string;
      matter?: MatterFile;
    };

    if (!body.studioId) {
      return NextResponse.json({ error: "Template id is required." }, { status: 400 });
    }

    if (!body.matter) {
      return NextResponse.json({ error: "Fake matter data is required." }, { status: 400 });
    }

    const template = getStudioTemplate(body.studioId);
    if (!template) {
      return NextResponse.json({ error: "Template was not found." }, { status: 404 });
    }

    if (template.kind !== "docx") {
      return NextResponse.json(
        { error: "This first Template Studio test mode supports DOCX templates. PDF form studio support is next." },
        { status: 422 },
      );
    }

    const applicability = templateAppliesToMatter(template, body.matter);
    if (!applicability.applies) {
      return NextResponse.json({ error: applicability.reason }, { status: 422 });
    }

    const { buffer, report } = await generateStudioDocxPreview(template, body.matter);
    const responseBody = buffer.slice(0);

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFileName(`TEST ${template.outputFileName}`)}"`,
        "X-Template-Studio-Report": encodeURIComponent(JSON.stringify({
          missingFields: report.missingFields,
          replacedPlaceholders: report.replacedPlaceholders,
        })),
      },
    });
  } catch (error) {
    console.error("Template Studio test generation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to test-generate this template." },
      { status: 500 },
    );
  }
}
