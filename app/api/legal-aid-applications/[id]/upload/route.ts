import { NextResponse } from "next/server";

import {
  getLegalAidApplicationFromSupabase,
  uploadLegalAidFileToSupabase,
} from "../../../../../lib/supabase-legal-aid";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.formData();
    const kind = body.get("kind");
    const upload = body.get("file");

    if (kind !== "incomeProof" && kind !== "signedPage") {
      return NextResponse.json({ error: "Upload kind must be incomeProof or signedPage." }, { status: 400 });
    }

    if (!(upload instanceof File) || upload.size === 0) {
      return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
    }

    const applicationResult = await getLegalAidApplicationFromSupabase(id);

    if (applicationResult.status === "not_configured") {
      return NextResponse.json(applicationResult);
    }

    if (!applicationResult.data) {
      return NextResponse.json({ error: "Legal Aid application was not found." }, { status: 404 });
    }

    const result = await uploadLegalAidFileToSupabase(applicationResult.data, kind, upload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Legal Aid upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save Legal Aid upload." },
      { status: 500 },
    );
  }
}
