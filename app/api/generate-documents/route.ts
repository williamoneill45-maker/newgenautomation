import { access, readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { draftDomesticViolenceAffidavit } from "../../../lib/affidavit-drafting";
import { buildMatterMergeFields } from "../../../lib/document-automation";
import { mergeDocxTemplate, type DocxMergeReport } from "../../../lib/docx-template";
import { buildInductionInstructionsDocx, inductionInstructionsFileName } from "../../../lib/induction-instructions-docx";
import type { MatterFile } from "../../../lib/matter";
import { getOneDriveClientFolderPaths, uploadFileToOneDrive, type OneDriveUploadResult } from "../../../lib/onedrive";
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
  affidavitDraft?: {
    output: string;
    source: string;
    diagnostic: string;
  };
};

type GeneratedFile = {
  fileName: string;
  buffer: ArrayBuffer;
  contentType: string;
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

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim().replace(/\s+/g, "_") || "Client";
}

function getApplicationType(matter: MatterFile): string {
  return matter.intake.selectedApplications.join(", ");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    matter?: MatterFile;
    uploadToOneDrive?: boolean;
    responseMode?: "zip" | "json";
    workflowId?: string;
  };

  if (!body.matter) {
    return NextResponse.json({ error: "Matter data is required." }, { status: 400 });
  }

  const bundle = new JSZip();
  const generatedFiles: GeneratedFile[] = [];
  const fields = buildMatterMergeFields(body.matter);
  const clientName = body.matter.clientName || body.matter.intake.applicant.fullName;
  const legalAidNumber = body.matter.legalAidNumber.trim();
  const clientEmail = body.matter.intake.applicant.emailAddress.trim();
  const clientPhone = body.matter.intake.applicant.mobilePhone.trim();
  const applicationType = getApplicationType(body.matter);
  const clientFolderPaths = getOneDriveClientFolderPaths({ clientName, legalAidNumber });
  const generatedAt = new Date().toISOString();
  const workflowId = body.workflowId?.trim() || `${body.matter.id}-standard-induction`;
  const validationReport: DocumentValidationReport = {
    generatedAt,
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

  const instructionsDocx = await buildInductionInstructionsDocx({
    clientName,
    clientEmail,
    legalAidNumber,
    applicationType,
    fileCreatedTimestamp: generatedAt,
    clientFolderPath: clientFolderPaths.clientFolderPath,
    formsFolderPath: clientFolderPaths.formsFolderPath,
    billingFolderPath: clientFolderPaths.billingFolderPath,
    documentsGenerated: true,
    msdRequestFileName: "05 MSD Request.docx",
  });
  bundle.file(inductionInstructionsFileName, instructionsDocx);
  generatedFiles.push({
    fileName: inductionInstructionsFileName,
    buffer: instructionsDocx,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

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
    const templateFields = {
      ...fields,
      ...(templateDefinition.id === "confidential_address_application"
        ? {
            APPLICANT_ADDRESS: body.matter.intake.applicant.homeAddress,
            applicant_home_address: body.matter.intake.applicant.homeAddress,
          }
        : {}),
    };
    if (!templateDefinition.sourceFileName.toLowerCase().endsWith(".docx")) {
      bundle.file(templateDefinition.outputFileName, sourceTemplate);
      generatedFiles.push({
        fileName: templateDefinition.outputFileName,
        buffer: sourceTemplate,
        contentType: "application/octet-stream",
      });
      validationReport.documents.push({
        template: templateDefinition.sourceFileName,
        output: templateDefinition.outputFileName,
        title: templateDefinition.title,
        report: {
          placeholders: [],
          missingFields: [],
          unusedFields: [],
          replacedPlaceholders: 0,
          structure: {
            samePackageFileList: true,
            unchangedNonTemplateFiles: true,
            onlyPlaceholderTextChanged: true,
            changedXmlFiles: [],
          },
        },
      });
      continue;
    }

    const { buffer, report } = await mergeDocxTemplate(sourceTemplate, templateFields);

    bundle.file(templateDefinition.outputFileName, buffer);
    generatedFiles.push({
      fileName: templateDefinition.outputFileName,
      buffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    validationReport.documents.push({
      template: templateDefinition.sourceFileName,
      output: templateDefinition.outputFileName,
      title: templateDefinition.title,
      report,
    });
  }

  const hasAffidavitNotes =
    body.matter.intake.domesticViolenceNotes.history.trim() ||
    body.matter.intake.domesticViolenceNotes.recentEvents.trim();

  if (hasAffidavitNotes) {
    const affidavit = await draftDomesticViolenceAffidavit(body.matter);
    const outputName = "07 Domestic Violence Affidavit Draft.txt";
    bundle.file(outputName, affidavit.draft);
    generatedFiles.push({
      fileName: outputName,
      buffer: new TextEncoder().encode(affidavit.draft).buffer,
      contentType: "text/plain; charset=utf-8",
    });
    validationReport.affidavitDraft = {
      output: outputName,
      source: affidavit.source,
      diagnostic: affidavit.diagnostic,
    };
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

  const validationReportText = JSON.stringify(validationReport, null, 2);
  bundle.file("template-validation-report.json", validationReportText);
  generatedFiles.push({
    fileName: "template-validation-report.json",
    buffer: new TextEncoder().encode(validationReportText).buffer,
    contentType: "application/json; charset=utf-8",
  });

  let oneDriveStatus = "not_configured";
  let oneDrivePath = "";
  let oneDriveError = "";
  const uploadedDocuments: Array<{ fileName: string; path: string; webUrl: string }> = [];

  if (body.uploadToOneDrive && !clientName.trim()) {
    oneDriveStatus = "failed";
    oneDriveError = "Client name is required before generated forms can be uploaded to OneDrive.";
  } else if (body.uploadToOneDrive && !legalAidNumber) {
    oneDriveStatus = "failed";
    oneDriveError = "Legal Aid Number is required before generated forms can be uploaded to Forms and Induction.";
  } else if (body.uploadToOneDrive && !clientEmail) {
    oneDriveStatus = "failed";
    oneDriveError = "Applicant email is required before instructions.docx can be uploaded for induction.";
  } else if (body.uploadToOneDrive && !applicationType) {
    oneDriveStatus = "failed";
    oneDriveError = "At least one application type is required before instructions.docx can be uploaded for induction.";
  } else if (body.uploadToOneDrive) {
    oneDrivePath = clientFolderPaths.formsFolderPath;

    try {
      const uploads: OneDriveUploadResult[] = [];
      for (const file of generatedFiles) {
        const upload = await uploadFileToOneDrive(file.fileName, file.buffer, {
          folderPath: clientFolderPaths.formsFolderPath,
          contentType: file.contentType,
        });
        uploads.push(upload);
        if (upload.status === "uploaded") {
          uploadedDocuments.push({
            fileName: file.fileName,
            path: upload.path,
            webUrl: upload.webUrl,
          });
        }
      }
      const instructionPayload = {
        workflowId,
        clientName,
        legalAidNumber,
        clientEmail,
        clientPhone,
        clientFolderPath: clientFolderPaths.clientFolderPath,
        packageType: "standard_induction",
      };
      uploads.push(await uploadFileToOneDrive(
        "Instruction.json",
        new TextEncoder().encode(JSON.stringify(instructionPayload, null, 2)).buffer,
        {
          folderPath: clientFolderPaths.formsFolderPath,
          contentType: "application/json; charset=utf-8",
        },
      ));
      oneDriveStatus = uploads.every((upload) => upload.status === "uploaded") ? "uploaded" : "not_configured";
      if (oneDriveStatus === "uploaded") {
        console.info(`Instruction handoff uploaded: ${clientFolderPaths.formsFolderPath}/Instruction.json`);
      }
    } catch (error) {
      console.error("Generated intake OneDrive upload failed", error);
      oneDriveStatus = "failed";
      oneDriveError = error instanceof Error ? error.message : "Generated documents could not be uploaded to OneDrive.";
    }
  }

  if (body.responseMode === "json") {
    if (body.uploadToOneDrive && oneDriveStatus !== "uploaded") {
      return NextResponse.json(
        {
          error: oneDriveError || "Generated documents could not be uploaded to OneDrive.",
          oneDriveStatus,
          oneDrivePath,
        },
        { status: oneDriveStatus === "not_configured" ? 503 : 500 },
      );
    }

    return NextResponse.json({
      status: "generated",
      oneDriveStatus,
      oneDrivePath,
      uploadedDocuments,
      inductionDocument: {
        fileName: inductionInstructionsFileName,
        path: oneDrivePath ? `${oneDrivePath}/${inductionInstructionsFileName}` : "",
      },
      instructionFile: {
        fileName: "Instruction.json",
        path: oneDrivePath ? `${oneDrivePath}/Instruction.json` : "",
      },
    });
  }

  const output = await bundle.generateAsync({ type: "arraybuffer" });

  return new NextResponse(output, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFileName(body.matter.clientName || body.matter.intake.applicant.fullName)}_Forms.zip"`,
      "X-OneDrive-Status": oneDriveStatus,
      "X-OneDrive-Path": encodeURIComponent(oneDrivePath),
      "X-OneDrive-Error": encodeURIComponent(oneDriveError),
    },
  });
}
