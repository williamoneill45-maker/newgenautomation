import { NextRequest, NextResponse } from "next/server";

import { authCookieName, authSessionValue } from "../../../lib/auth-gate";
import {
  createLegalAidClaim,
  listCurrentMonthClaims,
  updateLegalAidClaim,
  type LegalAidClaimInput,
} from "../../../lib/legal-aid-claims";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  return request.cookies.get(authCookieName)?.value === authSessionValue;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    return NextResponse.json(await listCurrentMonthClaims());
  } catch (error) {
    console.error("Legal Aid claims load failed", error);
    return NextResponse.json({ error: "Unable to load Legal Aid claims." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    const input = (await request.json()) as LegalAidClaimInput;
    if (!input.clientName?.trim() || !input.matterName?.trim() || !["32B", "33A"].includes(input.formType) || !(Number(input.amountClaimed) > 0)) {
      return NextResponse.json({ error: "Client, matter, form type, and amount claimed are required." }, { status: 400 });
    }
    return NextResponse.json(await createLegalAidClaim(input));
  } catch (error) {
    console.error("Legal Aid claim save failed", error);
    return NextResponse.json({ error: "Unable to create the Legal Aid claim." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Login required." }, { status: 401 });
  try {
    const input = (await request.json()) as {
      id?: string;
      markPaid?: boolean;
      amountPaid?: number;
      datePaid?: string;
      notes?: string;
    };
    if (!input.id?.trim()) return NextResponse.json({ error: "Claim ID is required." }, { status: 400 });
    return NextResponse.json(await updateLegalAidClaim({ ...input, id: input.id }));
  } catch (error) {
    console.error("Legal Aid claim update failed", error);
    return NextResponse.json({ error: "Unable to update the Legal Aid claim." }, { status: 500 });
  }
}
