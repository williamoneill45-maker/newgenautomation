import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import {
  drawObject,
  PDFHexString,
  PDFDocument,
  PDFName,
  type PDFPage,
  type PDFFont,
  type PDFRef,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateInPlace,
  StandardFonts,
  translate,
} from "pdf-lib";

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

function cleanReviewValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return /^\{\{[^{}]+\}\}$/.test(trimmed) ? "" : (value ?? "");
}

function sanitizeLegalAidReview(review: LegalAidReview): LegalAidReview {
  return {
    ...review,
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

  if (fieldName === "Question 6" && !review[reviewKey]?.trim()) {
    return " ";
  }

  return review[reviewKey] ?? "";
}

function getAnnotationText(annotation: unknown, key: string): string {
  const value = (annotation as { get: (name: PDFName) => unknown }).get(PDFName.of(key));
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return value.decodeText();
  }

  return "";
}

function getAnnotationRectangle(annotation: unknown) {
  const rectangle = (annotation as { lookup: (name: PDFName) => { asArray?: () => unknown[] } }).lookup(PDFName.of("Rect"));
  const coordinates = rectangle.asArray?.().map((value) => Number(String(value))) ?? [];
  if (coordinates.length !== 4 || coordinates.some((value) => Number.isNaN(value))) return null;

  const [x1, y1, x2, y2] = coordinates;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function drawWrappedText(page: PDFPage, font: PDFFont, text: string, rectangle: { x: number; y: number; width: number; height: number }) {
  const fontSize = 10;
  const lineHeight = 12;
  const padding = 4;
  const maxWidth = rectangle.width - padding * 2;
  const lines = text
    .split(/\r?\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      if (!words.length) return [""];

      return words.reduce<string[]>((wrapped, word) => {
        const current = wrapped[wrapped.length - 1] ?? "";
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !current) {
          wrapped[wrapped.length - 1] = candidate;
        } else {
          wrapped.push(word);
        }
        return wrapped;
      }, [""]);
    });

  lines.slice(0, Math.max(1, Math.floor((rectangle.height - padding * 2) / lineHeight))).forEach((line, index) => {
    if (!line.trim()) return;
    page.drawText(line, {
      x: rectangle.x + padding,
      y: rectangle.y + rectangle.height - padding - fontSize - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });
}

async function fillVisibleLegalAidWidgets(pdfDoc: PDFDocument, review: LegalAidReview) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const combinedNarrative = buildNarrative(review);

  for (const page of pdfDoc.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;

    const annotationRefsToRemove: PDFRef[] = [];
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotationRef = annotations.get(index) as PDFRef;
      const annotation = pdfDoc.context.lookup(annotationRef);
      const fieldName = getAnnotationText(annotation, "T");
      if (!Object.prototype.hasOwnProperty.call(textFieldMap, fieldName)) continue;

      const rectangle = getAnnotationRectangle(annotation);
      if (!rectangle) continue;

      const value = getLegalAidFieldValue(fieldName, review, combinedNarrative);
      page.drawRectangle({
        ...rectangle,
        color: rgb(0.93, 0.96, 0.9),
        borderColor: rgb(0.93, 0.96, 0.9),
      });
      drawWrappedText(page, font, value, rectangle);
      annotationRefsToRemove.push(annotationRef);
    }

    for (const annotationRef of annotationRefsToRemove) {
      page.node.removeAnnot(annotationRef);
    }
  }
}

function fillTextFields(pdfDoc: PDFDocument, review: LegalAidReview) {
  const form = pdfDoc.getForm();
  const safeReview = sanitizeLegalAidReview(review);
  const combinedNarrative = buildNarrative(safeReview);

  for (const [fieldName] of Object.entries(textFieldMap)) {
    let field;
    try {
      field = form.getTextField(fieldName);
    } catch {
      continue;
    }

    field.setText(getLegalAidFieldValue(fieldName, safeReview, combinedNarrative));
  }

  form.updateFieldAppearances();
}

function flattenLegalAidForm(pdfDoc: PDFDocument) {
  const form = pdfDoc.getForm();
  const unsafeForm = form as unknown as {
    findWidgetPage: (widget: unknown) => ReturnType<PDFDocument["getPage"]>;
    findWidgetAppearanceRef: (field: unknown, widget: unknown) => unknown;
  };

  form.updateFieldAppearances();

  for (const field of form.getFields()) {
    const widgets = field.acroField.getWidgets();

    for (const widget of widgets) {
      try {
        const page = unsafeForm.findWidgetPage(widget);
        const appearanceRef = unsafeForm.findWidgetAppearanceRef(field, widget) as Parameters<typeof page.node.newXObject>[1];
        const xObjectKey = page.node.newXObject("FlatWidget", appearanceRef);
        const rectangle = widget.getRectangle();
        const widgetRef = pdfDoc.context.getObjectRef(widget.dict);

        page.pushOperators(
          pushGraphicsState(),
          translate(rectangle.x, rectangle.y),
          ...rotateInPlace({ ...rectangle, rotation: 0 }),
          drawObject(xObjectKey),
          popGraphicsState(),
        );
        if (widgetRef) {
          page.node.removeAnnot(widgetRef);
          pdfDoc.context.delete(widgetRef);
        }
      } catch {
        // Some supplied Legal Aid PDF widgets reference pages that no longer exist.
        // Those stale widgets are discarded when the AcroForm is removed below.
      }
    }

    pdfDoc.context.delete(field.ref);
  }

  pdfDoc.catalog.delete(PDFName.of("AcroForm"));
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
      await fillVisibleLegalAidWidgets(pdfDoc, sanitizeLegalAidReview(application.review));
      flattenLegalAidForm(pdfDoc);

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

      const generatedAt = new Date().toISOString();
      await saveLegalAidApplicationToSupabase({
        ...application,
        status: "generated",
        updatedAt: generatedAt,
      });

      const buffer = await pdfDoc.save({ updateFieldAppearances: false });
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
    await fillVisibleLegalAidWidgets(pdfDoc, sanitizeLegalAidReview(review));
    flattenLegalAidForm(pdfDoc);

    const incomeProofBytes = await fileToBytes(incomeProof);
    const signedPageBytes = await fileToBytes(signedPage);

    if (!incomeProofBytes) {
      return NextResponse.json({ error: "Income proof screenshot or scan is required." }, { status: 400 });
    }

    if (!signedPageBytes) {
      return NextResponse.json({ error: "Signed client page 5 screenshot or scan is required." }, { status: 400 });
    }

    await insertLegalAidUploads(pdfDoc, incomeProof, incomeProofBytes, signedPage, signedPageBytes);

    const buffer = await pdfDoc.save({ updateFieldAppearances: false });
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
