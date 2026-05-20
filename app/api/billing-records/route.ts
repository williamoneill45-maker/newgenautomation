import { NextResponse } from "next/server";

import type { StoredBillingInvoice } from "../../../lib/billing-storage";
import { saveBillingInvoiceToSupabase } from "../../../lib/supabase-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const invoice = (await request.json()) as StoredBillingInvoice;

    if (!invoice.clientName?.trim() || !invoice.legalAidNumber?.trim() || !invoice.invoiceNumber?.trim()) {
      return NextResponse.json(
        { error: "Client name, legal aid number, and invoice number are required." },
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
