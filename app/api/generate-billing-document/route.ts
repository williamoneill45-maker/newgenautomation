import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server.js";
import JSZip from "jszip";

import {
  billingTemplateDefinitions,
  buildBillingMergeFields,
  calculateBillingTotals,
} from "../../../lib/billing-document.ts";
import { mergeDocxTemplate } from "../../../lib/docx-template.ts";
import type { BillingRecord } from "../../../lib/billing-automation.ts";
import { validateStructuredBillingRecord } from "../../../lib/billing-selection.ts";
import { uploadBillingDocumentToOneDrive } from "../../../lib/onedrive.ts";

export const runtime = "nodejs";

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "completed-billing-form";
}

type BillingEvidenceImageInput = {
  fileName: string;
  contentType: "image/png" | "image/jpeg";
  dataUrl: string;
  label?: string;
};

function decodeDataUrl(input: BillingEvidenceImageInput) {
  const base64 = input.dataUrl.includes(",") ? input.dataUrl.split(",").pop() ?? "" : input.dataUrl;
  const buffer = Buffer.from(base64, "base64");
  return {
    fileName: safeFileName(input.fileName),
    contentType: input.contentType,
    data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    label: input.label?.trim() || "Court direction",
  };
}

async function readBillingTemplate(sourcePath: string): Promise<ArrayBuffer> {
  const templatePath = path.join(process.cwd(), sourcePath);
  let template: Buffer;

  try {
    template = await readFile(templatePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing billing template: ${sourcePath}. Upload the reviewed Word template at this exact path, then redeploy.`);
    }

    throw error;
  }

  return template.buffer.slice(
    template.byteOffset,
    template.byteOffset + template.byteLength,
  ) as ArrayBuffer;
}

async function validateBillingTemplatePackage(template: ArrayBuffer, sourcePath: string): Promise<string | null> {
  const bytes = new Uint8Array(template);
  const startsWithZipHeader =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);

  if (!startsWithZipHeader) {
    return `${sourcePath} is not a modern OpenXML .dotx package. Re-save the form in Word using the Word Template (.dotx) format, then upload it again.`;
  }

  const zip = await JSZip.loadAsync(template);
  if (!zip.file("word/document.xml")) {
    return `${sourcePath} is missing word/document.xml, so it cannot be populated as a Word form template.`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      record?: BillingRecord;
      reviewed?: boolean;
      uploadToOneDrive?: boolean;
      evidenceImages?: BillingEvidenceImageInput[];
    };

    if (!body.record) {
      return NextResponse.json({ error: "A reviewed billing record is required." }, { status: 400 });
    }

    if (!body.reviewed) {
      return NextResponse.json(
        { error: "Review the billing record before generating the Word document." },
        { status: 400 },
      );
    }

    const selectionErrors = validateStructuredBillingRecord(body.record);
    if (selectionErrors.length) {
      return NextResponse.json({ error: selectionErrors.join(" ") }, { status: 400 });
    }

    const templateDefinition = billingTemplateDefinitions[body.record.formType];
    const sourceTemplate = await readBillingTemplate(templateDefinition.sourcePath);
    const templateError = await validateBillingTemplatePackage(sourceTemplate, templateDefinition.sourcePath);
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 422 });
    }

    const fields = buildBillingMergeFields(body.record);
    const travelCourt = body.record.draft.travel?.travelTimeValue
      ? body.record.draft.travel.court
      : "";
    const { buffer, report } = await mergeDocxTemplate(sourceTemplate, fields, {
      outputType: "document",
      normalizeBillingJudgeDirectionsRow: true,
      billingFormValues: {
        dateCompleted: new Intl.DateTimeFormat("en-NZ", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
        invoiceType: body.record.draft.structuredSelection?.invoiceType ?? "interim",
        mileageRate: "1.20",
      },
      imageAppendices: (body.evidenceImages ?? []).map(decodeDataUrl),
      ...(travelCourt
        ? {
            literalTextReplacements: {
              "Travel â€“ Time â€“ necessary": `Travel â€“ Time â€“ necessary to ${travelCourt.toLocaleUpperCase("en-NZ")}`,
            },
          }
        : {}),
    });
    const outputBuffer = Buffer.from(buffer);
    const uploadBuffer = outputBuffer.buffer.slice(
      outputBuffer.byteOffset,
      outputBuffer.byteOffset + outputBuffer.byteLength,
    ) as ArrayBuffer;
    const totals = calculateBillingTotals(body.record);
    const fileName = safeFileName(
      `${body.record.invoiceNumber || templateDefinition.outputFileName.replace(/\.docx$/i, "")}.docx`,
    );
    let oneDriveStatus = "not_configured";
    let oneDriveUrl = "";
    let oneDrivePath = "";

    if (body.uploadToOneDrive && report.missingFields.length) {
      return NextResponse.json(
        { error: `The generated billing form still contains unresolved placeholders: ${report.missingFields.map((field) => `{{${field}}}`).join(", ")}.` },
        { status: 422 },
      );
    }

    if (body.uploadToOneDrive) try {
      const upload = await uploadBillingDocumentToOneDrive(fileName, uploadBuffer, {
        clientName: body.record.clientName,
        legalAidNumber: body.record.legalAidNumber,
      });
      oneDriveStatus = upload.status;
      oneDriveUrl = upload.webUrl;
      oneDrivePath = upload.path;
    } catch (error) {
      console.error("OneDrive upload failed", error);
      oneDriveStatus = "failed";
    }

    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Billing-Template": templateDefinition.sourcePath,
        "X-Billing-Invoice-Number": body.record.invoiceNumber,
        "X-Billing-Invoice-Total": totals.total.toFixed(2),
        "X-OneDrive-Status": oneDriveStatus,
        "X-OneDrive-Url": encodeURIComponent(oneDriveUrl),
        "X-OneDrive-Path": encodeURIComponent(oneDrivePath),
        "X-Billing-Replaced-Placeholders": String(report.replacedPlaceholders),
        "X-Billing-Missing-Fields": encodeURIComponent(report.missingFields.join(",")),
      },
    });
  } catch (error) {
    console.error("Billing document generation failed", error);
    if (error instanceof Error && error.message.startsWith("Missing billing template:")) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    return NextResponse.json(
      { error: "Unable to generate the billing Word document from the .dotx template." },
      { status: 500 },
    );
  }
}

