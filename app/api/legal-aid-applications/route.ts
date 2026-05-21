import { NextResponse } from "next/server";

import type { LegalAidRecord, LegalAidReview } from "../../../lib/legal-aid";
import {
  createLegalAidRecord,
  getLegalAidApplicationFromSupabase,
  listLegalAidApplicationsFromSupabase,
  saveLegalAidApplicationToSupabase,
} from "../../../lib/supabase-legal-aid";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pendingOnly = url.searchParams.get("pending") === "true";
    const result = await listLegalAidApplicationsFromSupabase(pendingOnly);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Legal Aid application list failed", error);
    return NextResponse.json(
      { error: "Unable to load Legal Aid applications." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      record?: LegalAidRecord;
      review?: LegalAidReview;
    };
    let record = payload.record ?? (payload.review ? createLegalAidRecord(payload.review) : null);

    if (!record) {
      return NextResponse.json({ error: "Legal Aid review data is required." }, { status: 400 });
    }

    if (!payload.record && payload.review) {
      const existing = await getLegalAidApplicationFromSupabase(record.id);
      if (existing.status === "loaded" && existing.data) {
        record = {
          ...existing.data,
          clientName: payload.review.clientName,
          review: payload.review,
          status: existing.data.status === "generated" ? "ready_to_generate" : existing.data.status,
        };
      }
    }

    if (!record.review.clientName?.trim()) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }

    const result = await saveLegalAidApplicationToSupabase(record);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Legal Aid application save failed", error);
    return NextResponse.json(
      { error: "Unable to save Legal Aid application." },
      { status: 500 },
    );
  }
}
