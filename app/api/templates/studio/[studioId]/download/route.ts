import { NextResponse } from "next/server";

import { resolveTemplateSource } from "../../../../../../lib/template-resolver";
import { getStudioTemplate } from "../../../../../../lib/template-studio";

export const runtime = "nodejs";

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim().replace(/\s+/g, "_") || "template.docx";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  try {
    const { studioId } = await params;
    const template = getStudioTemplate(studioId);
    if (!template) return NextResponse.json({ error: "Template was not found." }, { status: 404 });

    const url = new URL(request.url);
    const versionId = url.searchParams.get("versionId") || undefined;
    const resolution = await resolveTemplateSource(template, { versionId });
    const fileName = versionId
      ? `${safeFileName(template.title)}-${versionId.slice(0, 8)}.docx`
      : template.sourceFileName.split("/").pop() ?? template.outputFileName;

    return new NextResponse(resolution.buffer.slice(0), {
      headers: {
        "Content-Type": template.kind === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFileName(fileName)}"`,
        "X-Template-Source": resolution.source,
        "X-Template-Version": resolution.versionId ?? "",
      },
    });
  } catch (error) {
    console.error("Template download failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to download template." },
      { status: 500 },
    );
  }
}
