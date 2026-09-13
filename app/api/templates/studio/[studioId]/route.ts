import { NextResponse } from "next/server";

import { scanDocxBuffer } from "../../../../../lib/template-scanner";
import { getTemplateManifest, uploadTemplateVersion } from "../../../../../lib/supabase-template-versions";
import { getStudioTemplate } from "../../../../../lib/template-studio";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  try {
    const { studioId } = await params;
    const template = getStudioTemplate(studioId);
    if (!template) return NextResponse.json({ error: "Template was not found." }, { status: 404 });

    return NextResponse.json(await getTemplateManifest(template));
  } catch (error) {
    console.error("Template manifest load failed", error);
    return NextResponse.json({ error: "Unable to load template versions." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  try {
    const { studioId } = await params;
    const template = getStudioTemplate(studioId);
    if (!template) return NextResponse.json({ error: "Template was not found." }, { status: 404 });
    if (template.kind !== "docx") return NextResponse.json({ error: "Only DOCX replacement is supported in this phase." }, { status: 422 });

    const form = await request.formData();
    const file = form.get("file");
    const notes = typeof form.get("notes") === "string" ? String(form.get("notes")) : "";
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A DOCX file is required." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx files can be uploaded." }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Template is too large. Maximum size is 15 MB." }, { status: 400 });
    }

    const placeholders = await scanDocxBuffer(await file.arrayBuffer());
    const scanResult = {
      fileName: file.name,
      sourcePath: file.name,
      exists: true,
      fileType: "docx" as const,
      canScan: true,
      placeholders,
      knownPlaceholders: placeholders.filter((placeholder) => placeholder.status === "known").map((placeholder) => placeholder.key),
      legacyPlaceholders: placeholders.filter((placeholder) => placeholder.status === "legacy"),
      unknownPlaceholders: placeholders.filter((placeholder) => placeholder.status === "unknown"),
      malformedPlaceholders: placeholders.filter((placeholder) => placeholder.status === "malformed"),
      recommendations: placeholders.some((placeholder) => placeholder.status === "malformed")
        ? ["Fix malformed placeholders before publishing this version."]
        : ["Uploaded draft is ready for test generation."],
    };

    return NextResponse.json(await uploadTemplateVersion({ template, file, scanResult, notes }));
  } catch (error) {
    console.error("Template upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload template version." },
      { status: 500 },
    );
  }
}
