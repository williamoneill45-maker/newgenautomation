import { NextResponse } from "next/server";

import type { MatterFile } from "../../../../../../lib/matter";
import { generateStudioDocxPreview, getStudioTemplate, templateAppliesToMatter } from "../../../../../../lib/template-studio";

export const runtime = "nodejs";

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim().replace(/\s+/g, "_") || "Template_Test";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  try {
    const { studioId } = await params;
    const template = getStudioTemplate(studioId);
    if (!template) return NextResponse.json({ error: "Template was not found." }, { status: 404 });
    if (template.kind !== "docx") {
      return NextResponse.json({ error: "DOCX test generation is supported first. PDF field testing is Phase 3." }, { status: 422 });
    }

    const body = await request.json() as { matter?: MatterFile; versionId?: string };
    if (!body.matter) return NextResponse.json({ error: "Fake matter data is required." }, { status: 400 });
    const applicability = templateAppliesToMatter(template, body.matter);
    if (!applicability.applies) return NextResponse.json({ error: applicability.reason }, { status: 422 });

    const { buffer, report } = await generateStudioDocxPreview(template, body.matter, { versionId: body.versionId });

    return new NextResponse(buffer.slice(0), {
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
    console.error("Template Studio version test failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to test-generate this template." },
      { status: 500 },
    );
  }
}
