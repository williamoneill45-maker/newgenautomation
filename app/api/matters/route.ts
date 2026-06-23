import { NextRequest, NextResponse } from "next/server";

import { authCookieName, authSessionValue } from "../../../lib/auth-gate";
import type { MatterFile } from "../../../lib/matter";
import { listMattersFromSupabase, saveMatterToSupabase } from "../../../lib/supabase-matters";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  return request.cookies.get(authCookieName)?.value === authSessionValue;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    return NextResponse.json(await listMattersFromSupabase());
  } catch (error) {
    console.error("Matter load failed", error);
    return NextResponse.json({ error: "Unable to load matters." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    const body = (await request.json()) as { matter?: MatterFile; clientId?: string };
    if (!body.matter?.id || !(body.matter.clientName || body.matter.intake?.applicant?.fullName)?.trim()) {
      return NextResponse.json({ error: "Matter id and client name are required." }, { status: 400 });
    }
    return NextResponse.json(await saveMatterToSupabase(body.matter, body.clientId ?? ""));
  } catch (error) {
    console.error("Matter save failed", error);
    return NextResponse.json({ error: "Unable to save matter." }, { status: 500 });
  }
}
