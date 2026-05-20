import { access, readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { buildMatterMergeFields } from "../../../lib/document-automation";
import { mergeDocxTemplate, type DocxMergeReport } from "../../../lib/docx-template";
import type { MatterFile } from "../../../lib/matter";
import { standardDocxTemplates } from "../../../lib/template-catalog";

export const runtime = "nodejs";

type DocumentValidationReport = {
  generatedAt: string;
  matterId: string;
  rules: string[];
  skippedDocuments: Array<{
    template: string;
    title: string;
    reason: string;
  }>;
  documents: Array<{
    template: string;
    output: string;
    title: string;
    report: DocxMergeReport;
  }>;
};

async function readSourceTemplate(fileName: string): Promise<ArrayBuffer> {
  const templatePath = path.join(process.cwd(), "templates", fileName);
  const template = await readFile(templatePath);
  return template.buffer.slice(
    template.byteOffset,
    template.byteOffset + template.byteLength,
  ) as ArrayBuffer;
}

async function templateExists(fileName: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), "templates", fileName));
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    matter?: MatterFile;
  };

  if (!body.matter) {
    return NextResponse.json({ error: "Matter data is required." }, { status: 400 });
  }

  const bundle = new JSZip();
  const fields = buildMatterMergeFields(body.matter);
  const validationReport: DocumentValidationReport = {
    generatedAt: new Date().toISOString(),
    matterId: body.matter.id,
    rules: [
      "Source DOCX templates are read from /templates.",
      "Only double-curly placeholders are replaced.",
      "Missing fields are left unchanged in the completed DOCX.",
      "No AI generation is used for the standard DOCX forms.",
      "Missing source templates are skipped and listed in this validation report.",
    ],
    skippedDocuments: [],
    documents: [],
  };

  for (const templateDefinition of standardDocxTemplates) {
    if (!(await templateExists(templateDefinition.sourceFileName))) {
      validationReport.skippedDocuments.push({
        template: templateDefinition.sourceFileName,
        title: templateDefinition.title,
        reason: "Source template is missing from /templates.",
      });
      continue;
    }

    const sourceTemplate = await readSourceTemplate(templateDefinition.sourceFileName);
    const { buffer, report } = await mergeDocxTemplate(sourceTemplate, fields);

    bundle.file(templateDefinition.outputFileName, buffer);
    validationReport.documents.push({
      template: templateDefinition.sourceFileName,
      output: templateDefinition.outputFileName,
      title: templateDefinition.title,
      report,
    });
  }

  if (validationReport.documents.length === 0) {
    return NextResponse.json(
      {
        error:
          "No DOCX source templates were found in /templates. Please upload the standard Family Court templates and try again.",
      },
      { status: 400 },
    );
  }

  bundle.file(
    "template-validation-report.json",
    JSON.stringify(validationReport, null, 2),
  );

  const output = await bundle.generateAsync({ type: "arraybuffer" });

  return new NextResponse(output, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="family-court-documents.zip"',
    },
  });
}
