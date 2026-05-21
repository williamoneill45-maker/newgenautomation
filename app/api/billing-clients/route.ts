import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../lib/billing-storage";
import {
  listBillingClientsFromSupabase,
  saveBillingClientToSupabase,
} from "../../../lib/supabase-billing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listBillingClientsFromSupabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing client load failed", error);
    return NextResponse.json(
      { error: "Unable to load billing client metadata." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const client = (await request.json()) as BillingClientProfile;

    if (!client.id || !client.clientName?.trim()) {
      return NextResponse.json(
        { error: "Client id and name are required." },
        { status: 400 },
      );
    }

    const result = await saveBillingClientToSupabase(client);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing client save failed", error);
    return NextResponse.json(
      { error: "Unable to save billing client metadata." },
      { status: 500 },
    );
  }
}
