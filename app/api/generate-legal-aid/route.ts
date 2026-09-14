import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server.js";
import {
  PDFName,
  PDFDocument,
  StandardFonts,
} from "pdf-lib";

import {
  legalAidTemplatePath,
  type LegalAidReview,
} from "../../../lib/legal-aid.ts";
import {
  downloadLegalAidFileFromSupabase,
  getLegalAidApplicationFromSupabase,
  saveLegalAidApplicationToSupabase,
} from "../../../lib/supabase-legal-aid.ts";

export const runtime = "nodejs";

type UploadKind = "incomeProof" | "signedPage";
type UploadDescriptor = Pick<File, "name" | "type">;

const textFieldMap: Record<string, keyof LegalAidReview> = {
  "Question 2": "clientName",
  "Question 4": "dob",
  "Question 5": "homeAddress",
  "Question 6": "lawyerPostalAddress",
  "Question 7": "mobilePhone",
  "Question 11": "email",
  "Question 13-2": "numberOfChildren",
  "131": "numberOfChildren",
  "Question 31": "courtLocation",
  "Question 33": "protectionOrderWording",
  "Signature date lawyer": "dateToday",
};

function cleanReviewValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return /^\{\{[^{}]+\}\}$/.test(trimmed) ? "" : (value ?? "");
}

function sanitizeLegalAidReview(review: LegalAidReview): LegalAidReview {
  return {
    ...review,
    title: cleanReviewValue(review.title),
    clientName: cleanReviewValue(review.clientName),
    dob: cleanReviewValue(review.dob),
    homeAddress: cleanReviewValue(review.homeAddress),
    lawyerPostalAddress: cleanReviewValue(review.lawyerPostalAddress),
    mobilePhone: cleanReviewValue(review.mobilePhone),
    email: cleanReviewValue(review.email),
    numberOfChildren: cleanReviewValue(review.numberOfChildren),
    courtLocation: cleanReviewValue(review.courtLocation),
    proceedingsType: cleanReviewValue(review.proceedingsType),
    protectionOrderWording: cleanReviewValue(review.protectionOrderWording),
    parentingOrderWording: cleanReviewValue(review.parentingOrderWording),
    abuseSummary: cleanReviewValue(review.abuseSummary),
    dateToday: cleanReviewValue(review.dateToday),
  };
}

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "Legal Aid Application";
}

async function readTemplate(): Promise<Uint8Array> {
  return readFile(path.join(process.cwd(), legalAidTemplatePath));
}

function buildNarrative(review: LegalAidReview): string {
  return [
    [
      review.protectionOrderWording,
      review.abuseSummary,
      review.parentingOrderWording,
    ]
      .filter(Boolean)
      .join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getLegalAidFieldValue(fieldName: string, review: LegalAidReview, combinedNarrative: string): string {
  const reviewKey = textFieldMap[fieldName];
  if (!reviewKey) return "";

  if (fieldName === "Question 31") {
    return [review.courtLocation, review.proceedingsType].filter(Boolean).join(", ");
  }

  if (fieldName === "Question 33") {
    return combinedNarrative;
  }

  return review[reviewKey] ?? "";
}

function fillTextFields(pdfDoc: PDFDocument, review: LegalAidReview) {
  const form = pdfDoc.getForm();
  const safeReview = sanitizeLegalAidReview(review);
  const combinedNarrative = buildNarrative(safeReview);

  setTitleFields(pdfDoc, safeReview.title ?? "");

  for (const [fieldName] of Object.entries(textFieldMap)) {
    let field;
    try {
      field = form.getTextField(fieldName);
    } catch {
      continue;
    }

    field.setText(getLegalAidFieldValue(fieldName, safeReview, combinedNarrative));
  }
}

function setTitleFields(pdfDoc: PDFDocument, title: string) {
  const form = pdfDoc.getForm();
  const titleCheckboxes: Record<string, string> = {
    Miss: "title 1",
    Ms: "title 2",
    Mrs: "title 3",
    Mr: "title 4",
  };

  for (const [label, fieldName] of Object.entries(titleCheckboxes)) {
    try {
      const checkbox = form.getCheckBox(fieldName);
      if (label === title) {
        checkbox.check();
      } else {
        checkbox.uncheck();
      }
    } catch {
      // The official template controls which title widgets are available.
    }
  }

  if (!title || Object.prototype.hasOwnProperty.call(titleCheckboxes, title)) return;

  for (const fieldName of ["title", "Title", "Other title", "Custom title"]) {
    try {
      form.getTextField(fieldName).setText(title);
      return;
    } catch {
      // Keep trying known title text field names.
    }
  }
}

function assertLegalAidAcroForm(pdfDoc: PDFDocument) {
  const acroForm = pdfDoc.catalog.get(PDFName.of("AcroForm"));
  if (!acroForm) {
    throw new Error("Generated Legal Aid PDF is missing the document AcroForm.");
  }

  const form = pdfDoc.getForm();
  const fieldNames = new Set(form.getFields().map((field) => field.getName()));
  if (fieldNames.size === 0) {
    throw new Error("Generated Legal Aid PDF has an AcroForm but no fields.");
  }

  for (const fieldName of ["Question 2", "Question 4", "Question 5", "Question 31", "Question 33"]) {
    if (!fieldNames.has(fieldName)) {
      throw new Error(`Generated Legal Aid PDF is missing expected field ${fieldName}.`);
    }
  }
}

async function saveEditableLegalAidPdf(pdfDoc: PDFDocument): Promise<Uint8Array> {
  assertLegalAidAcroForm(pdfDoc);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pdfDoc.getForm().updateFieldAppearances(font);
  const buffer = await pdfDoc.save();
  const savedPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  assertLegalAidAcroForm(savedPdf);
  return buffer;
}

async function fileToBytes(file: File | null): Promise<Uint8Array | null> {
  if (!file || file.size === 0) return null;
  return new Uint8Array(await file.arrayBuffer());
}

function getImagePageSize(pdfDoc: PDFDocument) {
  const firstPage = pdfDoc.getPage(0);
  return firstPage.getSize();
}

async function insertImagePage(
  pdfDoc: PDFDocument,
  index: number,
  bytes: Uint8Array,
  contentType: string,
) {
  const image = contentType.includes("png")
    ? await pdfDoc.embedPng(bytes)
    : await pdfDoc.embedJpg(bytes);
  const { width, height } = getImagePageSize(pdfDoc);
  const page = pdfDoc.insertPage(index, [width, height]);
  const margin = 36;
  const availableWidth = width - margin * 2;
  const availableHeight = height - margin * 2;
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  page.drawImage(image, {
    x: (width - imageWidth) / 2,
    y: (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
}

async function insertPdfPages(
  pdfDoc: PDFDocument,
  index: number,
  bytes: Uint8Array,
  mode: "all" | "first",
): Promise<number> {
  const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const sourceIndexes = mode === "first"
    ? [0]
    : sourcePdf.getPageIndices();
  const copiedPages = await pdfDoc.copyPages(sourcePdf, sourceIndexes);

  copiedPages.forEach((page, offset) => {
    pdfDoc.insertPage(index + offset, page);
  });
  return copiedPages.length;
}

function detectUploadType(file: UploadDescriptor, bytes: Uint8Array): "pdf" | "png" | "jpg" | "" {
  const contentType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  if (contentType.includes("pdf") || fileName.endsWith(".pdf") || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return "pdf";
  if (contentType.includes("png") || fileName.endsWith(".png") || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || (bytes[0] === 0xff && bytes[1] === 0xd8)) return "jpg";
  return "";
}

async function insertUpload(
  pdfDoc: PDFDocument,
  index: number,
  file: UploadDescriptor,
  bytes: Uint8Array,
  kind: UploadKind,
): Promise<number> {
  const uploadType = detectUploadType(file, bytes);

  if (uploadType === "pdf") {
    return insertPdfPages(pdfDoc, index, bytes, kind === "incomeProof" ? "all" : "first");
  }

  if (uploadType === "png" || uploadType === "jpg") {
    await insertImagePage(pdfDoc, index, bytes, uploadType === "png" ? "image/png" : "image/jpeg");
    return 1;
  }

  throw new Error(`${file.name} must be a PNG, JPG, or PDF upload.`);
}

async function insertLegalAidUploads(
  pdfDoc: PDFDocument,
  incomeProofFile: UploadDescriptor,
  incomeProofBytes: Uint8Array,
  signedPageFile: UploadDescriptor,
  signedPageBytes: Uint8Array,
) {
  const incomeInsertedPages = await insertUpload(pdfDoc, 2, incomeProofFile, incomeProofBytes, "incomeProof");
  const originalSignedPageIndex = 4 + incomeInsertedPages;
  if (pdfDoc.getPageCount() > originalSignedPageIndex) {
    pdfDoc.removePage(originalSignedPageIndex);
  }
  await insertUpload(pdfDoc, originalSignedPageIndex, signedPageFile, signedPageBytes, "signedPage");
}

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const applicationId = body.get("applicationId");
    const reviewPayload = body.get("review");
    const incomeProof = body.get("incomeProof");
    const signedPage = body.get("signedPage");
    const includeSupportingUploads = body.get("includeSupportingUploads") === "true";

    if (typeof applicationId === "string" && applicationId.trim()) {
      const applicationResult = await getLegalAidApplicationFromSupabase(applicationId);

      if (applicationResult.status === "not_configured") {
        return NextResponse.json(
          { error: `Supabase is missing ${applicationResult.missing.join(", ")}.` },
          { status: 500 },
        );
      }

      const application = applicationResult.data;

      if (!application) {
        return NextResponse.json({ error: "Legal Aid application was not found." }, { status: 404 });
      }

      const pdfDoc = await PDFDocument.load(await readTemplate(), { ignoreEncryption: true });
      fillTextFields(pdfDoc, application.review);

      if (includeSupportingUploads) {
        if (!application.incomeProofPath) {
          return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
        }

        if (!application.signedPagePath) {
          return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
        }

        const incomeProofBytes = await downloadLegalAidFileFromSupabase(application.incomeProofPath);
        const signedPageBytes = await downloadLegalAidFileFromSupabase(application.signedPagePath);
        const incomeProofFile = {
          name: application.incomeProofFileName || "income-proof.pdf",
          type: "",
        };
        const signedPageFile = {
          name: application.signedPageFileName || "signed-page-5.pdf",
          type: "",
        };

        await insertLegalAidUploads(pdfDoc, incomeProofFile, incomeProofBytes, signedPageFile, signedPageBytes);
      }

      const generatedAt = new Date().toISOString();
      await saveLegalAidApplicationToSupabase({
        ...application,
        status: "generated",
        updatedAt: generatedAt,
      });

      const buffer = await saveEditableLegalAidPdf(pdfDoc);
      const responseBody = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      const fileName = safeFileName(`Legal Aid Application - ${application.review.clientName}.pdf`);

      return new NextResponse(responseBody, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "X-Legal-Aid-Template": legalAidTemplatePath,
        },
      });
    }

    if (typeof reviewPayload !== "string") {
      return NextResponse.json({ error: "Legal Aid review data is required." }, { status: 400 });
    }

    if (includeSupportingUploads && (!(incomeProof instanceof File) || incomeProof.size === 0)) {
      return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
    }

    if (includeSupportingUploads && (!(signedPage instanceof File) || signedPage.size === 0)) {
      return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
    }

    const review = JSON.parse(reviewPayload) as LegalAidReview;
    const pdfDoc = await PDFDocument.load(await readTemplate(), { ignoreEncryption: true });
    fillTextFields(pdfDoc, review);

    const incomeProofBytes = includeSupportingUploads && incomeProof instanceof File ? await fileToBytes(incomeProof) : null;
    const signedPageBytes = includeSupportingUploads && signedPage instanceof File ? await fileToBytes(signedPage) : null;

    if (includeSupportingUploads && !incomeProofBytes) {
      return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
    }

    if (includeSupportingUploads && !signedPageBytes) {
      return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
    }

    if (includeSupportingUploads && incomeProof instanceof File && signedPage instanceof File && incomeProofBytes && signedPageBytes) {
      await insertLegalAidUploads(pdfDoc, incomeProof, incomeProofBytes, signedPage, signedPageBytes);
    }

    const buffer = await saveEditableLegalAidPdf(pdfDoc);
    const responseBody = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const fileName = safeFileName(`Legal Aid Application - ${review.clientName}.pdf`);

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Legal-Aid-Template": legalAidTemplatePath,
      },
    });
  } catch (error) {
    console.error("Legal Aid generation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate Legal Aid application." },
      { status: 500 },
    );
  }
}
