import { access, readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import {
  buildTemplateMergeFields,
  getInformationSheetEthnicityCheckboxes,
} from "../../../lib/document-automation";
import { buildAdditionalChildLines } from "../../../lib/child-continuation";
import { mergeDocxTemplate, type DocxMergeReport } from "../../../lib/docx-template";
import type { MatterFile } from "../../../lib/matter";
import { getOneDriveClientFolderPaths, uploadFileToOneDrive, type OneDriveUploadResult } from "../../../lib/onedrive";
import {
  buildStandardAffidavitContent,
  isParentingOrderSought,
  isProtectionOrderSought,
} from "../../../lib/standard-affidavit";
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

function describeUnresolvedPlaceholders(report: DocumentValidationReport): string {
  return report.documents
    .flatMap((document) =>
      document.report.missingFields.map((field) => `${document.output}: {{${field}}}`),
    )
    .join(", ");
}

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
      "The Family Violence Affidavit uses standardized wording; History and Recent Events are intentionally left blank.",
      "Conditional affidavit paragraphs retain the template's editable Word text and automatic numbering.",
      "Missing source templates are skipped and listed in this validation report.",
    ],
    skippedDocuments: [],
    documents: [],
  };
  const hasProtectionOrder = isProtectionOrderSought(body.matter);
  const hasParentingOrder = isParentingOrderSought(body.matter);
  const affidavitContent = buildStandardAffidavitContent(body.matter);

  for (const templateDefinition of standardDocxTemplates) {
    const conditionalSkip =
      (templateDefinition.id === "confidential_address_application" && !body.matter.intake.applicant.isAddressConfidential)
      || (templateDefinition.id === "parenting_order_application" && !hasParentingOrder)
      || (templateDefinition.id === "protection_order_application" && !hasProtectionOrder)
      || (templateDefinition.id === "domestic_violence_affidavit" && !hasProtectionOrder);
    if (conditionalSkip) {
      validationReport.skippedDocuments.push({
        template: templateDefinition.sourceFileName,
        title: templateDefinition.title,
        reason: "This document is not required for the applications selected in this matter.",
      });
      continue;
    }

    if (!(await templateExists(templateDefinition.sourceFileName))) {
      if (templateDefinition.id === "domestic_violence_affidavit" && hasProtectionOrder) {
        return NextResponse.json(
          { error: "A Protection Order is included, but the affidavit source template is missing from /templates." },
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
    const templateFields = {
      ...fields,
      ...(templateDefinition.id === "confidential_address_application"
        ? {
            APPLICANT_ADDRESS: body.matter.intake.applicant.homeAddress,
            applicant_home_address: body.matter.intake.applicant.homeAddress,
          }
        : {}),
      ...(templateDefinition.id === "domestic_violence_affidavit"
        ? {
            Applicant_Name: "Applicant",
            English_court_name: typeof fields.English_court_name === "string" ? fields.English_court_name.toUpperCase() : "",
            Maori_court_name: typeof fields.Maori_court_name === "string" ? fields.Maori_court_name.toUpperCase() : "",
            affidavit_application_title: affidavitContent.applicationTitle,
            relationship_start_blurb: affidavitContent.relationshipStartBlurb,
            relationship_end: affidavitContent.relationshipEnd,
            violence_categories: "",
            insert_history_blurb: "",
            insert_recent_events_blurb: "",
            children_blurb: "",
            protection_facts_heading: "",
            application_intro: affidavitContent.applicationIntro,
            without_notice_heading: "",
            without_notice_intro: "",
            without_notice_safety: "",
            parenting_heading: "",
            parenting_blurb: "",
            orders_sought_blurb: "",
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
        ? {
            childCount: Math.min(body.matter.intake.children.length, 3),
            repeatChildParagraphsThrough: body.matter.intake.children.length,
          }
        : {}),
      ...(templateDefinition.id === "information_sheet" && body.matter.intake.children.length > 3
        ? {
            continuationSections: [{
              heading: "ADDITIONAL CHILDREN AFFECTED BY THE APPLICATION",
              lines: buildAdditionalChildLines(body.matter),
            }],
          }
        : {}),
      ...(templateDefinition.id === "information_sheet"
        ? {
            informationSheetEthnicityCheckboxes: [
              getInformationSheetEthnicityCheckboxes(body.matter.intake.applicant.ethnicity),
              getInformationSheetEthnicityCheckboxes(body.matter.intake.respondent.ethnicity),
            ] as [boolean[], boolean[]],
          }
        : {}),
      ...(templateDefinition.id === "domestic_violence_affidavit"
        ? {
            paragraphInsertions: {
              children_blurb: affidavitContent.childrenParagraphs,
              protection_facts_heading: affidavitContent.protectionFactsHeading,
              violence_categories: [""],
              insert_history_blurb: [""],
              insert_recent_events_blurb: [""],
              without_notice_heading: affidavitContent.withoutNoticeHeading,
              without_notice_intro: affidavitContent.withoutNoticeIntro,
              without_notice_safety: affidavitContent.withoutNoticeSafetyFactors,
              parenting_heading: affidavitContent.parentingHeading,
              parenting_blurb: affidavitContent.parentingParagraphs,
              orders_sought_blurb: affidavitContent.ordersSoughtParagraphs,
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
  } else if (body.uploadToOneDrive && validationReport.documents.some((document) => document.report.missingFields.length > 0)) {
    oneDriveStatus = "failed";
    oneDriveError = `Generated forms still contain unresolved placeholders and were not uploaded to OneDrive: ${describeUnresolvedPlaceholders(validationReport)}.`;
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
