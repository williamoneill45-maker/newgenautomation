import { NextResponse } from "next/server";

import type { StoredBillingInvoice } from "../../../lib/billing-storage";
import {
  clearBillingInvoicesFromSupabase,
  deleteBillingInvoiceFromSupabase,
  listBillingInvoicesFromSupabase,
  saveBillingInvoiceToSupabase,
} from "../../../lib/supabase-billing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listBillingInvoicesFromSupabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing invoice load failed", error);
    return NextResponse.json(
      { error: "Unable to load billing invoice metadata." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const invoice = (await request.json()) as StoredBillingInvoice;

    if (!invoice.clientName?.trim() || !invoice.invoiceNumber?.trim()) {
      return NextResponse.json(
        { error: "Client name and invoice number are required." },
        { status: 400 },
      );
    }

    const result = await saveBillingInvoiceToSupabase(invoice);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing invoice save failed", error);
    return NextResponse.json(
      { error: "Unable to save billing invoice metadata." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { invoiceId?: string; clearAll?: boolean };

    if (body.clearAll) {
      return NextResponse.json(await clearBillingInvoicesFromSupabase());
    }

    if (!body.invoiceId?.trim()) {
      return NextResponse.json(
        { error: "Invoice id is required." },
        { status: 400 },
      );
    }

    return NextResponse.json(await deleteBillingInvoiceFromSupabase(body.invoiceId));
  } catch (error) {
    console.error("Billing invoice delete failed", error);
    return NextResponse.json(
      { error: "Unable to delete billing invoice metadata." },
      { status: 500 },
    );
  }
}
