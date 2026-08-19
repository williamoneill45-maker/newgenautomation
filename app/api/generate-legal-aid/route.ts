import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server.js";
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
  "Question 3-3": "otherNamesUsed",
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

type Rectangle = { x: number; y: number; width: number; height: number };
type CheckboxTarget = { pageIndex: number; yes: Rectangle; no: Rectangle };
type TitleTarget = { pageIndex: number; rectangles: Record<string, Rectangle> };

const legalAidDefaultNoCheckboxFields = [
  "Question 12",
  "Question 181",
  "Question 191",
  "Question 201",
  "Question 211",
] as const;
const legalAidCheckboxFallbackPages: Record<string, number> = {
  "Question 3": 0,
  "Question 12": 0,
  "Question 181": 2,
  "Question 191": 2,
  "Question 201": 2,
  "Question 211": 2,
};

function cleanReviewValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return /^\{\{[^{}]+\}\}$/.test(trimmed) ? "" : (value ?? "");
}

function normalizeConfidentialPostalAddress(value: string | undefined): string {
  return cleanReviewValue(value);
}

function sanitizeLegalAidReview(review: LegalAidReview): LegalAidReview {
  const hasUsedOtherNames = Boolean(review.hasUsedOtherNames && cleanReviewValue(review.otherNamesUsed).trim());
  return {
    ...review,
    hasUsedOtherNames,
    otherNamesUsed: hasUsedOtherNames ? cleanReviewValue(review.otherNamesUsed) : "",
    title: cleanReviewValue(review.title),
    clientName: cleanReviewValue(review.clientName),
    dob: cleanReviewValue(review.dob),
    homeAddress: normalizeConfidentialPostalAddress(review.homeAddress),
    lawyerPostalAddress: normalizeConfidentialPostalAddress(review.lawyerPostalAddress),
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

function drawLegalAidTitle(pdfDoc: PDFDocument, review: LegalAidReview, target: TitleTarget | null, font: PDFFont) {
  const title = review.title ?? "";

  if (target) {
    const page = pdfDoc.getPage(target.pageIndex);
    for (const rectangle of Object.values(target.rectangles)) {
      drawEmptyRadio(page, rectangle);
    }

    const selected = target.rectangles[title];
    if (selected) {
      drawRadioDot(page, selected);
      return;
    }
  } else {
    const page = pdfDoc.getPage(0);
    const checkboxX: Record<string, number> = { Miss: 244, Ms: 304, Mrs: 364, Mr: 424 };
    for (const x of Object.values(checkboxX)) {
      page.drawRectangle({ x: x - 3, y: 608, width: 18, height: 18, color: rgb(0.93, 0.96, 0.9) });
    }

    const x = checkboxX[title];
    if (typeof x === "number") {
      page.drawText("X", { x, y: 612, size: 10, font, color: rgb(0, 0, 0) });
      return;
    }
  }

  if (title) {
    const page = pdfDoc.getPage(target?.pageIndex ?? 0);
    page.drawText(title, { x: 198, y: 612, size: 10, font, color: rgb(0, 0, 0) });
    return;
  }
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

  if (fieldName === "Question 3-3") {
    return review.hasUsedOtherNames ? (review.otherNamesUsed ?? "") : "";
  }

  const value = review[reviewKey];
  const textValue = typeof value === "string" ? value : "";

  if (fieldName === "Question 6" && !textValue.trim()) {
    return " ";
  }

  return textValue;
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

  try {
    form.getCheckBox("title 1").uncheck();
  } catch {
    // Older copies of the template may not expose the default title widget.
  }

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

function collectYesNoCheckboxTargets(pdfDoc: PDFDocument, fieldNames: readonly string[]): Record<string, CheckboxTarget> {
  const form = pdfDoc.getForm();
  const unsafeForm = form as unknown as {
    findWidgetPage: (widget: unknown) => ReturnType<PDFDocument["getPage"]>;
  };
  const pages = pdfDoc.getPages();
  const targets: Record<string, CheckboxTarget> = {};

  for (const fieldName of fieldNames) {
    try {
      const field = form.getCheckBox(fieldName);
      const widgets = field.acroField.getWidgets()
        .map((widget) => {
          let pageIndex = legalAidCheckboxFallbackPages[fieldName] ?? -1;
          try {
            const page = unsafeForm.findWidgetPage(widget);
            pageIndex = pages.indexOf(page);
          } catch {
            // The Ministry template has a few stale widget page references.
            // Their rectangles still match the visible fixed template layout.
          }
          return {
            pageIndex,
            rectangle: widget.getRectangle(),
          };
        })
        .filter((widget): widget is { pageIndex: number; rectangle: Rectangle } => widget.pageIndex >= 0)
        .sort((left, right) => left.rectangle.x - right.rectangle.x);

      if (widgets.length >= 2) {
        targets[fieldName] = {
          pageIndex: widgets[0].pageIndex,
          yes: widgets[0].rectangle,
          no: widgets[1].rectangle,
        };
      }
    } catch {
      // Some template revisions omit optional checkbox fields.
    }
  }

  return targets;
}

function collectTitleTarget(pdfDoc: PDFDocument): TitleTarget | null {
  const form = pdfDoc.getForm();
  const unsafeForm = form as unknown as {
    findWidgetPage: (widget: unknown) => ReturnType<PDFDocument["getPage"]>;
  };
  const pages = pdfDoc.getPages();
  const titleNames = ["Miss", "Ms", "Mrs", "Mr"];

  try {
    const field = form.getCheckBox("title 1");
    const widgets = field.acroField.getWidgets()
      .map((widget) => {
        let pageIndex = 0;
        try {
          const page = unsafeForm.findWidgetPage(widget);
          pageIndex = pages.indexOf(page);
        } catch {
          // Fall back to page 1; the title widgets are visibly on the first page.
        }
        return {
          pageIndex,
          rectangle: widget.getRectangle(),
        };
      })
      .filter((widget): widget is { pageIndex: number; rectangle: Rectangle } => widget.pageIndex >= 0)
      .sort((left, right) => left.rectangle.x - right.rectangle.x);

    if (widgets.length < titleNames.length) return null;

    return {
      pageIndex: widgets[0].pageIndex,
      rectangles: Object.fromEntries(
        titleNames.map((titleName, index) => [titleName, widgets[index].rectangle]),
      ),
    };
  } catch {
    return null;
  }
}

function getLegalAidCheckboxChoices(review: LegalAidReview): Record<string, "yes" | "no"> {
  return {
    "Question 3": review.hasUsedOtherNames ? "yes" : "no",
    ...Object.fromEntries(legalAidDefaultNoCheckboxFields.map((fieldName) => [fieldName, "no"])),
  };
}

function drawRadioDot(page: PDFPage, rectangle: Rectangle) {
  page.drawEllipse({
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2,
    xScale: rectangle.width * 0.28,
    yScale: rectangle.height * 0.28,
    color: rgb(0, 0, 0),
  });
}

function drawEmptyRadio(page: PDFPage, rectangle: Rectangle) {
  const centerX = rectangle.x + rectangle.width / 2;
  const centerY = rectangle.y + rectangle.height / 2;
  page.drawEllipse({
    x: centerX,
    y: centerY,
    xScale: rectangle.width * 0.46,
    yScale: rectangle.height * 0.46,
    color: rgb(0.93, 0.96, 0.9),
  });
  page.drawEllipse({
    x: centerX,
    y: centerY,
    xScale: rectangle.width * 0.46,
    yScale: rectangle.height * 0.46,
    borderColor: rgb(0.62, 0.65, 0.62),
    borderWidth: 1,
  });
}

function isSameRectangle(left: Rectangle, right: Rectangle): boolean {
  return Math.abs(left.x - right.x) < 1
    && Math.abs(left.y - right.y) < 1
    && Math.abs(left.width - right.width) < 1
    && Math.abs(left.height - right.height) < 1;
}

function removeLegalAidCheckboxWidgets(pdfDoc: PDFDocument, targets: Record<string, CheckboxTarget>) {
  const rectanglesByPage = new Map<number, Rectangle[]>();
  for (const target of Object.values(targets)) {
    rectanglesByPage.set(target.pageIndex, [
      ...(rectanglesByPage.get(target.pageIndex) ?? []),
      target.yes,
      target.no,
    ]);
  }

  for (const [pageIndex, targetRectangles] of rectanglesByPage.entries()) {
    const page = pdfDoc.getPage(pageIndex);
    const annotations = page.node.Annots();
    if (!annotations) continue;

    const annotationRefsToRemove: PDFRef[] = [];
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotationRef = annotations.get(index) as PDFRef;
      const annotation = pdfDoc.context.lookup(annotationRef);
      const rectangle = getAnnotationRectangle(annotation);
      if (!rectangle) continue;
      if (targetRectangles.some((targetRectangle) => isSameRectangle(rectangle, targetRectangle))) {
        annotationRefsToRemove.push(annotationRef);
      }
    }

    for (const annotationRef of annotationRefsToRemove) {
      page.node.removeAnnot(annotationRef);
      pdfDoc.context.delete(annotationRef);
    }
  }
}

function removeLegalAidTitleWidgets(pdfDoc: PDFDocument, target: TitleTarget | null) {
  if (!target) return;
  const page = pdfDoc.getPage(target.pageIndex);
  const annotations = page.node.Annots();
  if (!annotations) return;

  const targetRectangles = Object.values(target.rectangles);
  const annotationRefsToRemove: PDFRef[] = [];
  for (let index = 0; index < annotations.size(); index += 1) {
    const annotationRef = annotations.get(index) as PDFRef;
    const annotation = pdfDoc.context.lookup(annotationRef);
    const rectangle = getAnnotationRectangle(annotation);
    if (!rectangle) continue;
    if (targetRectangles.some((targetRectangle) => isSameRectangle(rectangle, targetRectangle))) {
      annotationRefsToRemove.push(annotationRef);
    }
  }

  for (const annotationRef of annotationRefsToRemove) {
    page.node.removeAnnot(annotationRef);
    pdfDoc.context.delete(annotationRef);
  }
}

function drawLegalAidDefaultCheckboxes(
  pdfDoc: PDFDocument,
  review: LegalAidReview,
  targets: Record<string, CheckboxTarget>,
) {
  const choices = getLegalAidCheckboxChoices(review);

  for (const [fieldName, choice] of Object.entries(choices)) {
    const target = targets[fieldName];
    if (!target) continue;

    const page = pdfDoc.getPage(target.pageIndex);
    drawEmptyRadio(page, target.yes);
    drawEmptyRadio(page, target.no);
    drawRadioDot(page, target[choice]);
  }
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

    if (field.getName() === "title 1") {
      for (const widget of widgets) {
        const widgetRef = pdfDoc.context.getObjectRef(widget.dict);
        if (widgetRef) pdfDoc.getPage(0).node.removeAnnot(widgetRef);
      }
      continue;
    }

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
      const review = sanitizeLegalAidReview(application.review);
      const checkboxTargets = collectYesNoCheckboxTargets(pdfDoc, ["Question 3", ...legalAidDefaultNoCheckboxFields]);
      const titleTarget = collectTitleTarget(pdfDoc);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fillTextFields(pdfDoc, review);
      await fillVisibleLegalAidWidgets(pdfDoc, review);
      removeLegalAidCheckboxWidgets(pdfDoc, checkboxTargets);
      removeLegalAidTitleWidgets(pdfDoc, titleTarget);
      flattenLegalAidForm(pdfDoc);
      drawLegalAidTitle(pdfDoc, review, titleTarget, font);
      drawLegalAidDefaultCheckboxes(pdfDoc, review, checkboxTargets);

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

    const review = sanitizeLegalAidReview(JSON.parse(reviewPayload) as LegalAidReview);
    const pdfDoc = await PDFDocument.load(await readTemplate(), { ignoreEncryption: true });
    const checkboxTargets = collectYesNoCheckboxTargets(pdfDoc, ["Question 3", ...legalAidDefaultNoCheckboxFields]);
    const titleTarget = collectTitleTarget(pdfDoc);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fillTextFields(pdfDoc, review);
    await fillVisibleLegalAidWidgets(pdfDoc, review);
    removeLegalAidCheckboxWidgets(pdfDoc, checkboxTargets);
    removeLegalAidTitleWidgets(pdfDoc, titleTarget);
    flattenLegalAidForm(pdfDoc);
    drawLegalAidTitle(pdfDoc, review, titleTarget, font);
    drawLegalAidDefaultCheckboxes(pdfDoc, review, checkboxTargets);

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
