import { NextResponse } from "next/server";

import type { StoredBillingInvoice } from "../../../../../lib/billing-storage";
import {
  saveBillingInvoiceToSupabase,
  uploadBillingEvidenceToSupabase,
} from "../../../../../lib/supabase-billing";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const evidenceLabel = String(formData.get("evidenceLabel") ?? "");
    const invoiceJson = String(formData.get("invoice") ?? "");

    if (!(file instanceof File) || !evidenceLabel.trim() || !invoiceJson) {
      return NextResponse.json(
        { error: "Evidence file, evidence label, and invoice metadata are required." },
        { status: 400 },
      );
    }

    const invoice = JSON.parse(invoiceJson) as StoredBillingInvoice;
    const upload = await uploadBillingEvidenceToSupabase({
      invoiceId: id,
      evidenceLabel,
      file,
    });

    if (upload.status === "not_configured") {
      return NextResponse.json(upload);
    }

    const nextMissingEvidence = (invoice.missingEvidence ?? []).filter(
      (label) => label !== evidenceLabel,
    );
    const nextInvoice: StoredBillingInvoice = {
      ...invoice,
      status: nextMissingEvidence.length ? "pending_evidence" : "ready_to_generate",
      missingEvidence: nextMissingEvidence,
      evidenceFiles: [
        ...(invoice.evidenceFiles ?? []),
        {
          label: evidenceLabel,
          fileName: file.name,
          storagePath: upload.storagePath,
          uploadedAt: new Date().toISOString(),
        },
      ],
    };

    await saveBillingInvoiceToSupabase(nextInvoice);

    return NextResponse.json({ status: "uploaded", invoice: nextInvoice });
  } catch (error) {
    console.error("Billing evidence upload failed", error);
    return NextResponse.json(
      { error: "Unable to upload billing evidence." },
      { status: 500 },
    );
  }
}
