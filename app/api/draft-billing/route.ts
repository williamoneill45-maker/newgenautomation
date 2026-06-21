import { NextResponse } from "next/server";
import {
  createBillingRecord,
  toBillingRecordRow,
  type BillingDraftInput,
} from "../../../lib/billing-automation";
import { buildBillingMergeFields, calculateBillingTotals } from "../../../lib/billing-document";
import {
  createStructuredBillingRecord,
  type StructuredBillingInput,
} from "../../../lib/billing-selection";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BillingDraftInput & { structuredInput?: StructuredBillingInput };

    if (!body.structuredInput && !body.prompt?.trim()) {
      return NextResponse.json({ error: "A billing prompt is required." }, { status: 400 });
    }

    const record = body.structuredInput
      ? createStructuredBillingRecord(body.structuredInput)
      : createBillingRecord(body);
    const totals = calculateBillingTotals(record);
    const mergeFields = buildBillingMergeFields(record);
    const supabaseRow = {
      ...toBillingRecordRow(record),
      invoice_total: totals.total,
    };

    return NextResponse.json({
      draft: record.draft,
      record,
      totals,
      mergeFields,
      supabaseRow,
      validationMessages: record.draft.warnings,
    });
  } catch (error) {
    console.error("Billing draft failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create billing draft." },
      { status: 400 },
    );
  }
}
