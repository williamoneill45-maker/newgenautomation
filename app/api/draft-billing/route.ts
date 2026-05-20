import { NextResponse } from "next/server";
import {
  createBillingRecord,
  toBillingRecordRow,
  type BillingDraftInput,
} from "../../../lib/billing-automation";
import { calculateBillingTotals } from "../../../lib/billing-document";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BillingDraftInput;

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "A billing prompt is required." }, { status: 400 });
    }

    const record = createBillingRecord(body);
    const totals = calculateBillingTotals(record);
    const supabaseRow = {
      ...toBillingRecordRow(record),
      invoice_total: totals.total,
    };

    return NextResponse.json({
      draft: record.draft,
      record,
      totals,
      supabaseRow,
      validationMessages: record.draft.warnings,
    });
  } catch (error) {
    console.error("Billing draft failed", error);
    return NextResponse.json(
      { error: "Unable to create billing draft." },
      { status: 500 },
    );
  }
}
