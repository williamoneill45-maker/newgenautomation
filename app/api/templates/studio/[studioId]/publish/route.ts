import { NextResponse } from "next/server";

import { activateTemplateVersion } from "../../../../../../lib/supabase-template-versions";
import { getStudioTemplate } from "../../../../../../lib/template-studio";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studioId: string }> },
) {
  try {
    const { studioId } = await params;
    const template = getStudioTemplate(studioId);
    if (!template) return NextResponse.json({ error: "Template was not found." }, { status: 404 });

    const body = await request.json() as { versionId?: string };
    if (!body.versionId) return NextResponse.json({ error: "Version id is required." }, { status: 400 });

    return NextResponse.json(await activateTemplateVersion(template, body.versionId));
  } catch (error) {
    console.error("Template publish failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish template version." },
      { status: 500 },
    );
  }
}
