import { access, readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import {
  buildTemplateMergeFields,
  getInformationSheetEthnicityCheckboxes,
} from "../../../lib/document-automation";
import {
  draftDomesticViolenceAffidavit,
  type AffidavitDraftResult,
} from "../../../lib/affidavit-drafting";
import { mergeDocxTemplate, type DocxMergeReport } from "../../../lib/docx-template";
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

function ensurePeriod(value: string): string {
  const trimmed = value.trim();
  return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
  const clientName = body.matter.clientName || body.matter.intake.applicant.fullName;
  const legalAidNumber = body.matter.legalAidNumber.trim();
  const clientEmail = body.matter.intake.applicant.emailAddress.trim();
  const applicationType = getApplicationType(body.matter);
  const clientFolderPaths = getOneDriveClientFolderPaths({ clientName, legalAidNumber });
  const generatedAt = new Date().toISOString();
  const validationReport: DocumentValidationReport = {
    generatedAt,
    matterId: body.matter.id,
    rules: [
      "Source DOCX templates are read from /templates.",
      "Double-curly placeholders are replaced deterministically.",
      "Information Sheet checkbox fields and unused Parenting Order child paragraphs are updated from intake data.",
      "Missing fields are left unchanged in the completed DOCX.",
      "AI drafting is used only for affidavit evidence; all other form fields are merged deterministically.",
      "Affidavit paragraph insertions retain the template's editable Word text and automatic numbering.",
      "Missing source templates are skipped and listed in this validation report.",
    ],
    skippedDocuments: [],
    documents: [],
  };
  const hasAffidavitNotes = Boolean(
    body.matter.intake.domesticViolenceNotes.history.trim() ||
      body.matter.intake.domesticViolenceNotes.recentEvents.trim(),
  );
  let affidavitDraft: AffidavitDraftResult | null = null;

  for (const templateDefinition of standardDocxTemplates) {
    if (templateDefinition.id === "domestic_violence_affidavit" && !hasAffidavitNotes) {
      validationReport.skippedDocuments.push({
        template: templateDefinition.sourceFileName,
        title: templateDefinition.title,
        reason: "No family violence notes were supplied.",
      });
      continue;
    }

    if (!(await templateExists(templateDefinition.sourceFileName))) {
      if (templateDefinition.id === "domestic_violence_affidavit" && hasAffidavitNotes) {
        return NextResponse.json(
          { error: "Family violence notes were supplied, but the affidavit source template is missing from /templates." },
          { status: 400 },
        );
      }
      validationReport.skippedDocuments.push({
        template: templateDefinition.sourceFileName,
        title: templateDefinition.title,
        reason: "Source template is missing from /templates.",
      });
      continue;
    }

    const sourceTemplate = await readSourceTemplate(templateDefinition.sourceFileName);
    const fields = buildTemplateMergeFields(body.matter, templateDefinition.id);
    if (templateDefinition.id === "domestic_violence_affidavit") {
      affidavitDraft = await draftDomesticViolenceAffidavit(body.matter);
      if (
        !affidavitDraft.sections.historyParagraphs.length &&
        !affidavitDraft.sections.recentEventParagraphs.length
      ) {
        return NextResponse.json(
          { error: "Family violence notes were supplied, but no affidavit paragraphs could be generated." },
          { status: 422 },
        );
      }
    }
    const applicantName = body.matter.intake.applicant.fullName || body.matter.clientName;
    const respondentName = body.matter.intake.respondent.fullName || "the Respondent";
    const parentingOrdersSought = affidavitDraft?.parentingOrdersSought ?? false;
    const templateFields = {
      ...fields,
      ...(templateDefinition.id === "confidential_address_application"
        ? {
            APPLICANT_ADDRESS: body.matter.intake.applicant.homeAddress,
            applicant_home_address: body.matter.intake.applicant.homeAddress,
          }
        : {}),
      ...(affidavitDraft
        ? {
            Applicant_Name: applicantName,
            relationship_start_blurb: affidavitDraft.relationshipStartBlurb,
            relationship_end: affidavitDraft.relationshipEnd,
            violence_categories: "",
            insert_history_blurb: "",
            insert_recent_events_blurb: "",
            children_blurb: "",
            application_intro: parentingOrdersSought
              ? `I am applying for a Protection Order. I am also applying for an interim Parenting Order against the Respondent ${respondentName}.`
              : `I am applying for a Protection Order against the Respondent ${respondentName}.`,
            parenting_heading: "",
            parenting_blurb: "",
            orders_sought_blurb: parentingOrdersSought
              ? "I seek a final Protection Order. I also seek an interim Parenting Order placing the children in my day-to-day care, with contact determined on terms that protect their safety and welfare."
              : "I seek a final Protection Order against the Respondent.",
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

    const { buffer, report } = await mergeDocxTemplate(sourceTemplate, templateFields, {
      ...(templateDefinition.id === "parenting_order_application"
        ? { childCount: Math.min(body.matter.intake.children.length, 3) }
        : {}),
      ...(templateDefinition.id === "information_sheet"
        ? {
            informationSheetEthnicityCheckboxes: [
              getInformationSheetEthnicityCheckboxes(body.matter.intake.applicant.ethnicity),
              getInformationSheetEthnicityCheckboxes(body.matter.intake.respondent.ethnicity),
            ] as [boolean[], boolean[]],
          }
        : {}),
      ...(templateDefinition.id === "domestic_violence_affidavit" && affidavitDraft
        ? {
            paragraphInsertions: {
              violence_categories: affidavitDraft.sections.violenceCategories.map(ensurePeriod),
              children_blurb: affidavitDraft.childrenParagraphs,
              insert_history_blurb: affidavitDraft.sections.historyParagraphs,
              insert_recent_events_blurb: affidavitDraft.sections.recentEventParagraphs,
              parenting_heading: affidavitDraft.parentingOrdersSought
                ? ["MY PROPOSAL FOR DAY-TO-DAY CARE AND CONTACT"]
                : [],
              parenting_blurb: affidavitDraft.sections.parentingParagraphs,
            },
          }
        : {}),
    });

    if (templateDefinition.id === "domestic_violence_affidavit" && report.missingFields.length) {
      return NextResponse.json(
        { error: `The affidavit template contains unresolved placeholders: ${report.missingFields.join(", ")}.` },
        { status: 422 },
      );
    }

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

  if (validationReport.documents.length === 0) {
    return NextResponse.json(
      {
        error:
          "No DOCX source templates were found in /templates. Please upload the standard Family Court templates and try again.",
      },
      { status: 400 },
    );
  }

  let oneDriveStatus = "not_configured";
  let oneDrivePath = "";
  let oneDriveError = "";
  const uploadedDocuments: Array<{ fileName: string; path: string; webUrl: string }> = [];

  if (body.uploadToOneDrive && !clientName.trim()) {
    oneDriveStatus = "failed";
    oneDriveError = "Client name is required before generated forms can be uploaded to OneDrive.";
  } else if (body.uploadToOneDrive && !clientEmail) {
    oneDriveStatus = "failed";
    oneDriveError = "Applicant email is required before forms can be uploaded for induction.";
  } else if (body.uploadToOneDrive && !applicationType) {
    oneDriveStatus = "failed";
    oneDriveError = "At least one application type is required before forms can be uploaded for induction.";
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
      oneDriveStatus = uploads.every((upload) => upload.status === "uploaded") ? "uploaded" : "not_configured";
      if (oneDriveStatus === "uploaded") {
        console.info(`Generated intake documents uploaded: ${clientFolderPaths.formsFolderPath}`);
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
