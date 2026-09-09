import { NextResponse } from "next/server";

import { scanDocxBuffer } from "../../../../lib/template-scanner";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a DOCX file named file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "Only DOCX files can be scanned." }, { status: 400 });
  }

  const placeholders = await scanDocxBuffer(await file.arrayBuffer());
  const knownPlaceholders = placeholders.filter((placeholder) => placeholder.status === "known");
  const legacyPlaceholders = placeholders.filter((placeholder) => placeholder.status === "legacy");
  const unknownPlaceholders = placeholders.filter((placeholder) => placeholder.status === "unknown");
  const malformedPlaceholders = placeholders.filter((placeholder) => placeholder.status === "malformed");

  return NextResponse.json({
    fileName: file.name,
    placeholders,
    summary: {
      known: knownPlaceholders.length,
      legacy: legacyPlaceholders.length,
      unknown: unknownPlaceholders.length,
      malformed: malformedPlaceholders.length,
      blocked: unknownPlaceholders.length > 0 || malformedPlaceholders.length > 0,
    },
  });
}
