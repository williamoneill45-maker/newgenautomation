import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

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
