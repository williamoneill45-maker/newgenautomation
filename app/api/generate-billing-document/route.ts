import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import JSZip from "jszip";

import {
  billingTemplateDefinitions,
  buildBillingMergeFields,
} from "../../../lib/billing-document";
import { mergeDocxTemplate } from "../../../lib/docx-template";
import type { BillingRecord } from "../../../lib/billing-automation";

export const runtime = "nodejs";

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "completed-billing-form";
}

async function readBillingTemplate(sourcePath: string): Promise<ArrayBuffer> {
  const templatePath = path.join(process.cwd(), sourcePath);
  const template = await readFile(templatePath);
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

    const templateDefinition = billingTemplateDefinitions[body.record.formType];
    const sourceTemplate = await readBillingTemplate(templateDefinition.sourcePath);
    const templateError = await validateBillingTemplatePackage(sourceTemplate, templateDefinition.sourcePath);
    if (templateError) {
      return NextResponse.json({ error: templateError }, { status: 422 });
    }

    const fields = buildBillingMergeFields(body.record);
    const { buffer, report } = await mergeDocxTemplate(sourceTemplate, fields, {
      outputType: "document",
    });
    const fileName = safeFileName(
      `${templateDefinition.outputFileName.replace(/\.docx$/i, "")} - ${body.record.clientName || body.record.matterId}.docx`,
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Billing-Template": templateDefinition.sourcePath,
        "X-Billing-Replaced-Placeholders": String(report.replacedPlaceholders),
        "X-Billing-Missing-Fields": encodeURIComponent(report.missingFields.join(",")),
      },
    });
  } catch (error) {
    console.error("Billing document generation failed", error);
    return NextResponse.json(
      { error: "Unable to generate the billing Word document from the .dotx template." },
      { status: 500 },
    );
  }
}
