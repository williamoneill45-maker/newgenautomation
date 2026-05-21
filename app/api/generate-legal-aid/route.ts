import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

import {
  legalAidTemplatePath,
  type LegalAidReview,
} from "../../../lib/legal-aid";
import {
  downloadLegalAidFileFromSupabase,
  getLegalAidApplicationFromSupabase,
  saveLegalAidApplicationToSupabase,
} from "../../../lib/supabase-legal-aid";

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

function safeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "Legal Aid Application";
}

async function readTemplate(): Promise<Uint8Array> {
  return readFile(path.join(process.cwd(), legalAidTemplatePath));
}

function buildNarrative(review: LegalAidReview): string {
  return [
    [review.courtLocation, review.proceedingsType].filter(Boolean).join(", "),
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

function fillTextFields(pdfDoc: PDFDocument, review: LegalAidReview) {
  const form = pdfDoc.getForm();
  const combinedNarrative = buildNarrative(review);

  for (const [fieldName, reviewKey] of Object.entries(textFieldMap)) {
    let field;
    try {
      field = form.getTextField(fieldName);
    } catch {
      continue;
    }

    const value = fieldName === "Question 31"
      ? [review.courtLocation, review.proceedingsType].filter(Boolean).join(", ")
      : fieldName === "Question 33"
        ? combinedNarrative
        : fieldName === "Question 6" && !review[reviewKey]?.trim()
          ? " "
          : review[reviewKey];

    field.setText(value ?? "");
  }

  form.updateFieldAppearances();
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
) {
  const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const sourceIndexes = mode === "first"
    ? [0]
    : sourcePdf.getPageIndices();
  const copiedPages = await pdfDoc.copyPages(sourcePdf, sourceIndexes);

  copiedPages.forEach((page, offset) => {
    pdfDoc.insertPage(index + offset, page);
  });
}

async function insertUpload(
  pdfDoc: PDFDocument,
  index: number,
  file: UploadDescriptor,
  bytes: Uint8Array,
  kind: UploadKind,
) {
  const contentType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (contentType.includes("pdf") || fileName.endsWith(".pdf")) {
    await insertPdfPages(pdfDoc, index, bytes, kind === "incomeProof" ? "all" : "first");
    return;
  }

  if (
    contentType.includes("png") ||
    contentType.includes("jpeg") ||
    contentType.includes("jpg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg")
  ) {
    await insertImagePage(pdfDoc, index, bytes, contentType || fileName);
    return;
  }

  throw new Error(`${file.name} must be a PNG, JPG, or PDF upload.`);
}

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const applicationId = body.get("applicationId");
    const reviewPayload = body.get("review");
    const incomeProof = body.get("incomeProof");
    const signedPage = body.get("signedPage");

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

      if (!application.incomeProofPath) {
        return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
      }

      if (!application.signedPagePath) {
        return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
      }

      const pdfDoc = await PDFDocument.load(await readTemplate(), { ignoreEncryption: true });
      fillTextFields(pdfDoc, application.review);

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

      await insertUpload(pdfDoc, 2, incomeProofFile, incomeProofBytes, "incomeProof");
      pdfDoc.removePage(5);
      await insertUpload(pdfDoc, 5, signedPageFile, signedPageBytes, "signedPage");

      const generatedAt = new Date().toISOString();
      await saveLegalAidApplicationToSupabase({
        ...application,
        status: "generated",
        updatedAt: generatedAt,
      });

      const buffer = await pdfDoc.save({ updateFieldAppearances: true });
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

    if (!(incomeProof instanceof File) || incomeProof.size === 0) {
      return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
    }

    if (!(signedPage instanceof File) || signedPage.size === 0) {
      return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
    }

    const review = JSON.parse(reviewPayload) as LegalAidReview;
    const pdfDoc = await PDFDocument.load(await readTemplate(), { ignoreEncryption: true });
    fillTextFields(pdfDoc, review);

    const incomeProofBytes = await fileToBytes(incomeProof);
    const signedPageBytes = await fileToBytes(signedPage);

    if (!incomeProofBytes) {
      return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
    }

    if (!signedPageBytes) {
      return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
    }

    await insertUpload(pdfDoc, 2, incomeProof, incomeProofBytes, "incomeProof");
    pdfDoc.removePage(5);
    await insertUpload(pdfDoc, 5, signedPage, signedPageBytes, "signedPage");

    const buffer = await pdfDoc.save({ updateFieldAppearances: true });
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
