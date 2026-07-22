import JSZip from "jszip";

import type { MergeFields, MergeFieldTextValue } from "./document-automation";

const WORD_XML_FILE_PATTERN =
  /^(word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml)$/;

type TextNodeMatch = {
  fullMatchStart: number;
  fullMatchEnd: number;
  openTag: string;
  rawText: string;
  text: string;
  closeTag: string;
  textStart: number;
  textEnd: number;
  changed: boolean;
};

export type TemplatePlaceholderValidation = {
  key: string;
  hasMatchingField: boolean;
};

export type DocxTemplateValidation = {
  placeholders: TemplatePlaceholderValidation[];
  missingFields: string[];
  unusedFields: string[];
};

export type DocxStructureValidation = {
  samePackageFileList: boolean;
  unchangedNonTemplateFiles: boolean;
  onlyPlaceholderTextChanged: boolean;
  changedXmlFiles: string[];
};

export type DocxMergeReport = DocxTemplateValidation & {
  replacedPlaceholders: number;
  structure: DocxStructureValidation;
};

export type DocxMergeResult = {
  buffer: ArrayBuffer;
  report: DocxMergeReport;
};

export type DocxMergeOptions = {
  outputType?: "document" | "template";
  childCount?: number;
  repeatChildParagraphsThrough?: number;
  informationSheetEthnicityCheckboxes?: [boolean[], boolean[]];
  paragraphInsertions?: Record<string, string[]>;
  literalTextReplacements?: Record<string, string>;
  removeFirstExplicitPageBreak?: boolean;
  affidavitFormatting?: {
    applicantName: string;
    respondentName: string;
    childNames: string[];
    includeCareOfChildrenLegislation?: boolean;
  };
  parentingApplicantName?: string;
  normalizeBillingJudgeDirectionsRow?: boolean;
  billingFormValues?: {
    dateCompleted: string;
    invoiceType: "interim" | "final";
    mileageRate: string;
  };
  continuationSections?: Array<{ heading: string; lines: string[]; pageBreak?: boolean }>;
  imageAppendices?: Array<{
    fileName: string;
    contentType: "image/png" | "image/jpeg";
    data: ArrayBuffer;
    label?: string;
  }>;
};

type DocxImageAppendix = NonNullable<DocxMergeOptions["imageAppendices"]>[number];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function normalizePlaceholderKey(key: string): string {
  return key.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFieldLookup(fields: MergeFields): Record<string, MergeFieldTextValue> {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      const safeValue = value ?? "";
      return [
        [key, safeValue],
        [normalizePlaceholderKey(key), safeValue],
      ];
    }),
  );
}

function hasPlaceholderValue(
  rawKey: string,
  fields: MergeFields,
  lookup: Record<string, MergeFieldTextValue>,
): boolean {
  if (Object.prototype.hasOwnProperty.call(fields, rawKey)) {
    return true;
  }

  return Object.prototype.hasOwnProperty.call(lookup, normalizePlaceholderKey(rawKey));
}

function getPlaceholderValue(
  rawKey: string,
  fields: MergeFields,
  lookup: Record<string, MergeFieldTextValue>,
  occurrenceIndex = 0,
): string {
  const fieldValues = fields as Record<string, MergeFieldTextValue>;
  const resolveValue = (value: MergeFieldTextValue): string => {
    if (Array.isArray(value)) {
      return value[occurrenceIndex] ?? "";
    }

    return value ?? "";
  };

  if (Object.prototype.hasOwnProperty.call(fields, rawKey)) {
    return resolveValue(fieldValues[rawKey]);
  }

  const normalizedKey = normalizePlaceholderKey(rawKey);

  if (Object.prototype.hasOwnProperty.call(lookup, normalizedKey)) {
    return resolveValue(lookup[normalizedKey]);
  }

  return "";
}

function readTextNodes(xml: string): TextNodeMatch[] {
  const matches: TextNodeMatch[] = [];
  // A self-closing <w:t/> is empty and must not be treated as an opening tag.
  // Otherwise the match can consume intervening OOXML until a later </w:t>.
  const textNodePattern = /(<w:t\b[^>]*?(?<!\/)>)([\s\S]*?)(<\/w:t>)/g;
  let match: RegExpExecArray | null;
  let textCursor = 0;

  while ((match = textNodePattern.exec(xml)) !== null) {
    const text = decodeXml(match[2]);
    matches.push({
      fullMatchStart: match.index,
      fullMatchEnd: match.index + match[0].length,
      openTag: match[1],
      rawText: match[2],
      text,
      closeTag: match[3],
      textStart: textCursor,
      textEnd: textCursor + text.length,
      changed: false,
    });
    textCursor += text.length;
  }

  return matches;
}

function removeUnusedChildBlocks(xml: string, childCount: number): string {
  const removeMissingBlock = (block: string): string => {
    const text = readTextNodes(block).map((node) => node.text).join("");
    const indices = [...text.matchAll(/\{\{[^{}]*child_(\d+)[^{}]*\}\}/gi)]
      .map((match) => Number(match[1]));
    return indices.length > 0 && indices.every((index) => index > childCount) ? "" : block;
  };

  const withoutRows = xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, removeMissingBlock);
  return withoutRows.replace(/<w:p\b[\s\S]*?<\/w:p>/g, removeMissingBlock);
}

function repeatChildParagraphs(
  xml: string,
  childCount: number,
): string {
  if (childCount <= 3) return xml;

  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = readTextNodes(paragraph).map((node) => node.text).join("");
    if (!text.includes("child_3_")) return paragraph;

    const additionalParagraphs = Array.from(
      { length: childCount - 3 },
      (_, offset) => offset + 4,
    ).map((childNumber) => replaceLiteralText(
      paragraph.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, ""),
      {
        child_3_name: `child_${childNumber}_name`,
        child_3_dob: `child_${childNumber}_dob`,
        "(“child_3_nickname”)": `(“child_${childNumber}_nickname”)`,
      },
    )).join("");

    return `${paragraph}${additionalParagraphs}`;
  });
}

function setCheckboxDefaults(rowXml: string, checkedStates: boolean[]): string {
  let checkboxIndex = 0;
  return rowXml.replace(
    /(<w:checkBox>[\s\S]*?<w:default w:val=")[01]("\/>[\s\S]*?<\/w:checkBox>)/g,
    (_match, prefix: string, suffix: string) => {
      const checked = checkedStates[checkboxIndex] ?? false;
      checkboxIndex += 1;
      return `${prefix}${checked ? "1" : "0"}${suffix}`;
    },
  );
}

function updateInformationSheetCheckboxes(
  xml: string,
  checkboxGroups: [boolean[], boolean[]],
): string {
  let groupIndex = 0;
  return xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
    if (groupIndex >= checkboxGroups.length) return row;
    const text = readTextNodes(row).map((node) => node.text).join("");
    if (!text.includes("Ethnic Origin") || !row.includes("<w:checkBox>")) return row;

    const updated = setCheckboxDefaults(row, checkboxGroups[groupIndex]);
    groupIndex += 1;
    return updated;
  });
}

function replaceParagraphText(paragraphXml: string, value: string): string {
  const nodes = readTextNodes(paragraphXml);
  const formattedValue = escapeXml(value).replace(
    /\r?\n/g,
    '</w:t><w:br/><w:t xml:space="preserve">',
  );
  if (!nodes.length) {
    return paragraphXml.replace(
      "</w:p>",
      `<w:r><w:t xml:space="preserve">${formattedValue}</w:t></w:r></w:p>`,
    );
  }

  let output = "";
  let cursor = 0;
  nodes.forEach((node, index) => {
    output += paragraphXml.slice(cursor, node.fullMatchStart);
    output += `${node.openTag}${index === 0 ? formattedValue : ""}${node.closeTag}`;
    cursor = node.fullMatchEnd;
  });
  return output + paragraphXml.slice(cursor);
}

function insertRepeatedParagraphs(
  xml: string,
  insertions: Record<string, string[]>,
): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = readTextNodes(paragraph).map((node) => node.text).join("").trim();
    const match = /^\{\{([^{}]+)\}\}$/.exec(text);
    if (!match) return paragraph;

    const key = normalizePlaceholderKey(match[1]);
    const values = Object.entries(insertions).find(
      ([candidate]) => normalizePlaceholderKey(candidate) === key,
    )?.[1];
    if (!values) return paragraph;

    return values
      .map((value) => {
        const populated = replaceParagraphText(paragraph, value.trim());
        if (!/^\([ivx]+\)/i.test(value.trim())) return populated;
        return populated
          .replace(/<w:numPr\b[\s\S]*?<\/w:numPr>/g, "")
          .replace(/<w:pStyle\b[^>]*\/>/g, "")
          .replace(
            /<w:pPr\b[^>]*>/,
            (tag) => `${tag}<w:spacing w:before="120" w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="720" w:firstLine="0"/>`,
          );
      })
      .map((populated) => {
        if (key !== "parenting_blurb") return populated;
        const populatedText = readTextNodes(populated).map((node) => node.text).join("").trim();
        if (/^\([ivx]+\)/i.test(populatedText) || /<w:numPr\b/.test(populated)) return populated;
        return populated.replace(
          /<w:pPr\b[^>]*>/,
          (tag) => `${tag}<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>`,
        );
      })
      .join("");
  });
}

function paragraphWithRuns(paragraph: string, runs: Array<{ text: string; bold?: boolean }>): string {
  const pPr = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] ?? "";
  const runXml = runs.map(({ text, bold }) =>
    `<w:r><w:rPr>${bold ? "<w:b/><w:bCs/>" : ""}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`,
  ).join("");
  return paragraph.replace(/(<w:p\b[^>]*>)[\s\S]*?<\/w:p>/, `$1${pPr}${runXml}</w:p>`);
}

function replaceStandaloneApplicantPreservingLayout(paragraph: string, applicantName: string): string {
  return paragraph.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    const runText = readTextNodes(run).map((node) => node.text).join("").trim();
    if (runText !== "Applicant") return run;
    let updated = run.replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/, `$1${escapeXml(applicantName)}$2`);
    if (/<w:rPr\b/.test(updated)) {
      updated = updated.replace(/<w:rPr\b[^>]*>/, (tag) => `${tag}<w:b/><w:bCs/>`);
    } else {
      updated = updated.replace(/<w:r\b[^>]*>/, (tag) => `${tag}<w:rPr><w:b/><w:bCs/></w:rPr>`);
    }
    return updated;
  });
}

function applyAffidavitFormatting(
  xml: string,
  formatting: NonNullable<DocxMergeOptions["affidavitFormatting"]>,
): string {
  let standaloneApplicantCount = 0;
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = readTextNodes(paragraph).map((node) => node.text).join("");
    const trimmed = text.trim();
    if (
      formatting.includeCareOfChildrenLegislation &&
      trimmed === "(Family Violence Act 2018 Sections 60 and 75)"
    ) {
      return replaceParagraphText(
        paragraph,
        "(Family Violence Act 2018 Sections 60 and 75)\n(Ss 48 and 49, Care of Children Act 2004).",
      );
    }
    if (trimmed === "Applicant") {
      standaloneApplicantCount += 1;
      // The first occurrence is the italic party-role label on the cover page.
      // The second is the signature caption and must retain its leading tabs so
      // the applicant's name remains directly beneath the signature line.
      return standaloneApplicantCount === 1
        ? paragraph
        : replaceStandaloneApplicantPreservingLayout(paragraph, formatting.applicantName);
    }
    if (trimmed.startsWith("AFFIRMED at ")) {
      return paragraphWithRuns(paragraph, [
        { text: "AFFIRMED", bold: true },
        { text: text.slice(text.indexOf(" at ")) },
      ]);
    }
    if (trimmed.startsWith("Affirmed this ")) {
      return paragraphWithRuns(paragraph, [{ text, bold: true }]);
    }
    if (trimmed.startsWith(`I, ${formatting.applicantName} of `)) {
      const start = text.indexOf(formatting.applicantName);
      return paragraphWithRuns(paragraph, [
        { text: text.slice(0, start) },
        { text: formatting.applicantName, bold: true },
        { text: text.slice(start + formatting.applicantName.length) },
      ]);
    }
    const childName = formatting.childNames.find((name) => name && text.includes(name));
    if (childName && text.includes("born")) {
      const start = text.indexOf(childName);
      return paragraphWithRuns(paragraph, [
        { text: text.slice(0, start) },
        { text: childName, bold: true },
        { text: text.slice(start + childName.length) },
      ]);
    }
    if (trimmed.startsWith("I am applying without notice for ")) {
      const start = text.indexOf(formatting.respondentName);
      const spacedParagraph = paragraph.replace(/<w:pPr\b[^>]*>/, (tag) => `${tag}<w:spacing w:after="240"/>`);
      if (start === -1) return spacedParagraph;
      return paragraphWithRuns(spacedParagraph, [
        { text: text.slice(0, start) },
        { text: formatting.respondentName, bold: true },
        { text: text.slice(start + formatting.respondentName.length) },
      ]);
    }
    return paragraph;
  });
}

function applyParentingFormatting(xml: string, applicantName: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = readTextNodes(paragraph).map((node) => node.text).join("");
    const nameStart = text.indexOf(applicantName);
    if (nameStart === -1 || !text.trim().startsWith(`I ${applicantName},`)) return paragraph;
    return paragraphWithRuns(paragraph, [
      { text: text.slice(0, nameStart) },
      { text: applicantName, bold: true },
      { text: text.slice(nameStart + applicantName.length) },
    ]);
  });
}

function appendContinuationSections(
  xml: string,
  sections: Array<{ heading: string; lines: string[]; pageBreak?: boolean }>,
): string {
  const populated = sections.filter((section) => section.lines.length > 0);
  if (!populated.length) return xml;
  const paragraphs = populated.map((section, sectionIndex) => {
    const pageBreak = sectionIndex === 0 && section.pageBreak !== false
      ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      : "";
    const heading = `<w:p><w:pPr><w:spacing w:before="0" w:after="240"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(section.heading)}</w:t></w:r></w:p>`;
    const lines = section.lines.map((line) => `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
    return `${pageBreak}${heading}${lines}`;
  }).join("");
  const finalSectionIndex = xml.lastIndexOf("<w:sectPr");
  if (finalSectionIndex === -1) return xml.replace("</w:body>", `${paragraphs}</w:body>`);
  return `${xml.slice(0, finalSectionIndex)}${paragraphs}${xml.slice(finalSectionIndex)}`;
}

function getPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function getJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

function imageSize(image: DocxImageAppendix): { width: number; height: number } {
  const bytes = new Uint8Array(image.data);
  return (image.contentType === "image/png" ? getPngSize(bytes) : getJpegSize(bytes)) ?? { width: 1200, height: 800 };
}

function fitImageEmu(image: DocxImageAppendix) {
  const size = imageSize(image);
  const maxWidth = 6.2 * 914400;
  const maxHeight = 8.2 * 914400;
  const ratio = Math.min(maxWidth / size.width, maxHeight / size.height);
  return {
    cx: Math.round(size.width * ratio),
    cy: Math.round(size.height * ratio),
  };
}

function imageParagraph(image: DocxImageAppendix, relId: string, index: number): string {
  const { cx, cy } = fitImageEmu(image);
  const name = escapeXml(image.fileName);
  return `<w:p><w:pPr><w:spacing w:after="160"/><w:keepNext/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(image.label || "Court direction")}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="280"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${1000 + index}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${2000 + index}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function appendImageAppendicesToDocumentXml(xml: string, images: NonNullable<DocxMergeOptions["imageAppendices"]>): string {
  if (!images.length) return xml;
  const heading = '<w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">Supporting Court Direction / Evidence</w:t></w:r></w:p>';
  const paragraphs = images.map((image, index) => imageParagraph(image, `rIdNewgenEvidence${index + 1}`, index + 1)).join("");
  const insertion = `${heading}${paragraphs}`;
  const finalSectionIndex = xml.lastIndexOf("<w:sectPr");
  if (finalSectionIndex === -1) return xml.replace("</w:body>", `${insertion}</w:body>`);
  return `${xml.slice(0, finalSectionIndex)}${insertion}${xml.slice(finalSectionIndex)}`;
}

function setBookmarkText(xml: string, bookmarkName: string, value: string): string {
  const pattern = new RegExp(
    `(<w:bookmarkStart\\b(?=[^>]*w:name="${escapeRegExp(bookmarkName)}")(?=[^>]*w:id="([^"]+)")[^>]*/>)[\\s\\S]*?(<w:bookmarkEnd\\b[^>]*w:id="\\2"[^>]*/>)`,
  );
  const run = value
    ? `<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`
    : "";
  return xml.replace(pattern, `$1${run}$3`);
}

function applyTemplateTransformations(xml: string, options: DocxMergeOptions, isMainDocument = false): string {
  let output = xml;
  if (isMainDocument && options.billingFormValues) {
    const values = options.billingFormValues;
    output = setBookmarkText(output, "DateCompleted", values.dateCompleted);
    output = setBookmarkText(output, "InterimInvoice", values.invoiceType === "interim" ? "X" : "");
    output = setBookmarkText(output, "FinalInvoice", values.invoiceType === "final" ? "X" : "");
    output = setBookmarkText(output, "TravelRate2", values.mileageRate);
    output = output.replace(/1\.17 per km/g, `${values.mileageRate} per km`);
    // Some 33A templates keep the old rate immediately after the TravelRate2
    // bookmark as well as inside it. Once the bookmark is populated this would
    // render as "$1.201.20". Keep the bookmark value and remove the duplicate.
    output = output.replace(
      /(<w:bookmarkEnd\b[^>]*\/>)(<w:r\b[^>]*>)<w:t\b[^>]*>(?:1\.20)? per km/g,
      '$1$2<w:t xml:space="preserve"> per km',
    );
  }
  if (isMainDocument && options.removeFirstExplicitPageBreak) {
    output = output.replace(/<w:br w:type="page"\s*\/>/, "");
  }
  if (isMainDocument && options.normalizeBillingJudgeDirectionsRow) {
    output = output.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
      const text = readTextNodes(row).map((node) => node.text).join("");
      if (!/Complying with\s+Judge[’']s directions/i.test(text)) return row;
      let normalized = row.replace(
        /<w:trPr\b[^>]*>/,
        (tag) => `${tag}<w:cantSplit/>`,
      );
      normalized = normalized.replace(
        /(<w:p\b[^>]*>[\s\S]*?<w:pPr\b[^>]*>)[\s\S]*?(<\/w:pPr>[\s\S]*?Complying with\s+Judge[’']s directions)/i,
        `$1<w:pStyle w:val="Details"/>$2`,
      );
      let cellIndex = 0;
      normalized = normalized.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
        const paragraphStyle = cellIndex < 2 ? "Details" : "DetailsFlushRight";
        cellIndex += 1;
        return cell.replace(
          /<w:p(\s[^>]*)?>(?:<w:pPr\b[\s\S]*?<\/w:pPr>)?/,
          (_paragraph, attributes = "") =>
            `<w:p${attributes}><w:pPr><w:pStyle w:val="${paragraphStyle}"/></w:pPr>`,
        );
      });
      return normalized;
    });
  }
  if (typeof options.childCount === "number") {
    output = removeUnusedChildBlocks(output, options.childCount);
  }
  if (typeof options.repeatChildParagraphsThrough === "number") {
    output = repeatChildParagraphs(output, options.repeatChildParagraphsThrough);
  }
  if (options.informationSheetEthnicityCheckboxes) {
    output = updateInformationSheetCheckboxes(
      output,
      options.informationSheetEthnicityCheckboxes,
    );
  }
  if (options.paragraphInsertions) {
    output = insertRepeatedParagraphs(output, options.paragraphInsertions);
  }
  if (options.literalTextReplacements) {
    output = replaceLiteralText(output, options.literalTextReplacements);
  }
  if (isMainDocument && options.continuationSections) {
    output = appendContinuationSections(output, options.continuationSections);
  }
  return output;
}

function findNodeIndexAtStart(nodes: TextNodeMatch[], offset: number): number {
  return nodes.findIndex(
    (node) => offset >= node.textStart && offset < node.textEnd,
  );
}

function findNodeIndexAtEnd(nodes: TextNodeMatch[], offset: number): number {
  return nodes.findIndex(
    (node) => offset > node.textStart && offset <= node.textEnd,
  );
}

function replaceTextRange(
  nodes: TextNodeMatch[],
  start: number,
  end: number,
  replacement: string,
): void {
  const firstNodeIndex = findNodeIndexAtStart(nodes, start);
  const lastNodeIndex = findNodeIndexAtEnd(nodes, end);

  if (firstNodeIndex === -1 || lastNodeIndex === -1) {
    return;
  }

  for (let index = firstNodeIndex; index <= lastNodeIndex; index += 1) {
    const node = nodes[index];
    const localStart = Math.max(start - node.textStart, 0);
    const localEnd = Math.min(end - node.textStart, node.text.length);

    if (index === firstNodeIndex && index === lastNodeIndex) {
      node.text =
        node.text.slice(0, localStart) + replacement + node.text.slice(localEnd);
      node.changed = true;
      continue;
    }

    if (index === firstNodeIndex) {
      node.text = node.text.slice(0, localStart) + replacement;
      node.changed = true;
      continue;
    }

    if (index === lastNodeIndex) {
      node.text = node.text.slice(localEnd);
      node.changed = true;
      continue;
    }

    node.text = "";
    node.changed = true;
  }
}

function replaceLiteralText(xml: string, replacements: Record<string, string>): string {
  const nodes = readTextNodes(xml);
  const fullText = nodes.map((node) => node.text).join("");
  const ranges: Array<{ start: number; end: number; value: string }> = [];

  for (const [source, value] of Object.entries(replacements)) {
    if (!source) continue;
    let start = fullText.indexOf(source);
    while (start !== -1) {
      ranges.push({ start, end: start + source.length, value });
      start = fullText.indexOf(source, start + source.length);
    }
  }

  for (const range of ranges.sort((left, right) => right.start - left.start)) {
    replaceTextRange(nodes, range.start, range.end, range.value);
  }

  let output = "";
  let xmlCursor = 0;
  for (const node of nodes) {
    output += xml.slice(xmlCursor, node.fullMatchStart);
    output += `${node.openTag}${node.changed ? escapeXml(node.text) : node.rawText}${node.closeTag}`;
    xmlCursor = node.fullMatchEnd;
  }
  return output + xml.slice(xmlCursor);
}

export function mergePlaceholdersInXml(xml: string, fields: MergeFields): string {
  const nodes = readTextNodes(xml);
  const fullText = nodes.map((node) => node.text).join("");
  const lookup = buildFieldLookup(fields);
  const placeholderPattern = /\{\{([^{}]+)\}\}/g;
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  const occurrenceCounts: Record<string, number> = {};
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(fullText)) !== null) {
    if (!hasPlaceholderValue(match[1], fields, lookup)) {
      continue;
    }

    const normalizedKey = normalizePlaceholderKey(match[1]);
    const occurrenceIndex = occurrenceCounts[normalizedKey] ?? 0;
    occurrenceCounts[normalizedKey] = occurrenceIndex + 1;

    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: getPlaceholderValue(match[1], fields, lookup, occurrenceIndex),
    });
  }

  for (const malformedKey of ["tgst"]) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPattern = new RegExp(`\\{\\{${escapeRegExp(malformedKey)}(?=Total|\\$|$)`, "g");
    while ((match = malformedPattern.exec(fullText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: getPlaceholderValue(malformedKey, fields, lookup),
      });
    }
  }

  for (const malformedKey of ["tt_total"]) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPattern = new RegExp(`\\{\\{${escapeRegExp(malformedKey)}`, "g");
    while ((match = malformedPattern.exec(fullText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: getPlaceholderValue(malformedKey, fields, lookup),
      });
    }
  }

  for (const malformedKey of Object.keys(fields)) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPatterns = [
      new RegExp(`\\{\\{${escapeRegExp(malformedKey)}\\}(?!\\})`, "g"),
      new RegExp(`\\{\\{${escapeRegExp(malformedKey)}(?=[\\s,.;:)])`, "g"),
    ];

    for (const malformedPattern of malformedPatterns) {
      while ((match = malformedPattern.exec(fullText)) !== null) {
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          value: getPlaceholderValue(malformedKey, fields, lookup),
        });
      }
    }
  }

  for (const malformedKey of ["JC_PREP_UNIT"]) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPattern = new RegExp(`\\{\\{${escapeRegExp(malformedKey)}\\}`, "g");
    while ((match = malformedPattern.exec(fullText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: getPlaceholderValue(malformedKey, fields, lookup),
      });
    }
  }

  for (const malformedKey of [
    "IA_UNIT",
    "FPH_P_QTY",
    "FPH_P_UNIT",
    "FPH_P_TOTAL",
    "FPH_H_QTY",
    "FPH_H_UNIT",
    "FPH_H_TOTAL",
  ]) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPattern = new RegExp(`\\{\\[${escapeRegExp(malformedKey)}\\}\\}`, "g");
    while ((match = malformedPattern.exec(fullText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: getPlaceholderValue(malformedKey, fields, lookup),
      });
    }
  }

  for (const malformedKey of ["travel_time"]) {
    if (!hasPlaceholderValue(malformedKey, fields, lookup)) {
      continue;
    }

    const malformedPattern = new RegExp(`\\{${escapeRegExp(malformedKey)}\\}\\}`, "g");
    while ((match = malformedPattern.exec(fullText)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        value: getPlaceholderValue(malformedKey, fields, lookup),
      });
    }
  }

  const uniqueReplacements = Array.from(
    new Map(
      replacements.map((replacement) => [
        `${replacement.start}:${replacement.end}`,
        replacement,
      ]),
    ).values(),
  );

  for (const replacement of uniqueReplacements.reverse()) {
    replaceTextRange(
      nodes,
      replacement.start,
      replacement.end,
      replacement.value,
    );
  }

  let output = "";
  let xmlCursor = 0;

  for (const node of nodes) {
    output += xml.slice(xmlCursor, node.fullMatchStart);
    output += `${node.openTag}${node.changed ? escapeXml(node.text) : node.rawText}${node.closeTag}`;
    xmlCursor = node.fullMatchEnd;
  }

  return output + xml.slice(xmlCursor);
}

function extractPlaceholdersFromXml(xml: string): string[] {
  const fullText = readTextNodes(xml)
    .map((node) => node.text)
    .join("");
  const placeholders = new Set<string>();
  const placeholderPattern = /\{\{([^{}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(fullText)) !== null) {
    placeholders.add(match[1]);
  }

  return [...placeholders].sort((a, b) => a.localeCompare(b));
}

function countReplaceablePlaceholdersInXml(xml: string, fields: MergeFields): number {
  const fullText = readTextNodes(xml)
    .map((node) => node.text)
    .join("");
  const lookup = buildFieldLookup(fields);
  const placeholderPattern = /\{\{([^{}]+)\}\}/g;
  let count = 0;
  let match: RegExpExecArray | null;

  while ((match = placeholderPattern.exec(fullText)) !== null) {
    if (hasPlaceholderValue(match[1], fields, lookup)) {
      count += 1;
    }
  }

  return count;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

async function readTemplateXmlFiles(zip: JSZip): Promise<Record<string, string>> {
  const xmlEntries = zip
    .filter((path) => WORD_XML_FILE_PATTERN.test(path))
    .map((file) => file.name);
  const entries = await Promise.all(
    xmlEntries.map(async (path) => [path, await zip.file(path)?.async("string")] as const),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"),
  );
}

export async function validateDocxTemplate(
  template: ArrayBuffer,
  fields: MergeFields,
): Promise<DocxTemplateValidation> {
  const zip = await JSZip.loadAsync(template);
  const xmlFiles = await readTemplateXmlFiles(zip);
  const lookup = buildFieldLookup(fields);
  const placeholders = uniqueSorted(
    Object.values(xmlFiles).flatMap((xml) => extractPlaceholdersFromXml(xml)),
  );
  const fieldKeys = Object.keys(fields);
  const usedNormalizedKeys = new Set(
    placeholders
      .filter((placeholder) => hasPlaceholderValue(placeholder, fields, lookup))
      .map(normalizePlaceholderKey),
  );

  return {
    placeholders: placeholders.map((key) => ({
      key,
      hasMatchingField: hasPlaceholderValue(key, fields, lookup),
    })),
    missingFields: placeholders.filter(
      (placeholder) => !hasPlaceholderValue(placeholder, fields, lookup),
    ),
    unusedFields: fieldKeys.filter(
      (fieldKey) => !usedNormalizedKeys.has(normalizePlaceholderKey(fieldKey)),
    ),
  };
}

async function validateDocxStructure(
  originalTemplate: ArrayBuffer,
  generatedDocument: ArrayBuffer,
  fields: MergeFields,
  options: DocxMergeOptions = {},
): Promise<DocxStructureValidation> {
  const [originalZip, generatedZip] = await Promise.all([
    JSZip.loadAsync(originalTemplate),
    JSZip.loadAsync(generatedDocument),
  ]);
  const originalFiles = originalZip
    .filter((_, file) => !file.dir)
    .map((file) => file.name)
    .sort();
  const generatedFiles = generatedZip
    .filter((_, file) => !file.dir)
    .map((file) => file.name)
    .sort();
  const samePackageFileList =
    originalFiles.length === generatedFiles.length &&
    originalFiles.every((fileName, index) => fileName === generatedFiles[index]);
  const changedXmlFiles: string[] = [];
  let unchangedNonTemplateFiles = true;
  let onlyPlaceholderTextChanged = samePackageFileList;

  for (const fileName of originalFiles) {
    const originalFile = originalZip.file(fileName);
    const generatedFile = generatedZip.file(fileName);

    if (!originalFile || !generatedFile) {
      onlyPlaceholderTextChanged = false;
      continue;
    }

    if (WORD_XML_FILE_PATTERN.test(fileName)) {
      const originalXml = await originalFile.async("string");
      const generatedXml = await generatedFile.async("string");
      const expectedXml = mergePlaceholdersInXml(
        applyTemplateTransformations(originalXml, options, fileName === "word/document.xml"),
        fields,
      );

      if (generatedXml !== originalXml) {
        changedXmlFiles.push(fileName);
      }

      if (generatedXml !== expectedXml) {
        onlyPlaceholderTextChanged = false;
      }
      continue;
    }

    if (options.outputType === "document" && fileName === "[Content_Types].xml") {
      const originalXml = await originalFile.async("string");
      const generatedXml = await generatedFile.async("string");

      if (generatedXml !== convertTemplateContentTypesToDocument(originalXml)) {
        unchangedNonTemplateFiles = false;
        onlyPlaceholderTextChanged = false;
      }
      continue;
    }

    const [originalBytes, generatedBytes] = await Promise.all([
      originalFile.async("uint8array"),
      generatedFile.async("uint8array"),
    ]);
    const sameBytes =
      originalBytes.length === generatedBytes.length &&
      originalBytes.every((byte, index) => byte === generatedBytes[index]);

    if (!sameBytes) {
      unchangedNonTemplateFiles = false;
      onlyPlaceholderTextChanged = false;
    }
  }

  return {
    samePackageFileList,
    unchangedNonTemplateFiles,
    onlyPlaceholderTextChanged,
    changedXmlFiles,
  };
}

function convertTemplateContentTypesToDocument(xml: string): string {
  return xml.replace(
    /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template\.main\+xml/g,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  );
}

function addImageDefaultsToContentTypes(xml: string, images: NonNullable<DocxMergeOptions["imageAppendices"]>): string {
  let output = xml;
  const needsPng = images.some((image) => image.contentType === "image/png") && !output.includes('Extension="png"');
  const needsJpeg = images.some((image) => image.contentType === "image/jpeg") && !output.includes('Extension="jpg"') && !output.includes('Extension="jpeg"');
  const additions = [
    needsPng ? '<Default Extension="png" ContentType="image/png"/>' : "",
    needsJpeg ? '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="jpeg" ContentType="image/jpeg"/>' : "",
  ].join("");
  if (additions) output = output.replace("</Types>", `${additions}</Types>`);
  return output;
}

function addImageRelationships(xml: string, images: NonNullable<DocxMergeOptions["imageAppendices"]>): string {
  const additions = images.map((image, index) => {
    const extension = image.contentType === "image/png" ? "png" : "jpg";
    return `<Relationship Id="rIdNewgenEvidence${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/newgen-evidence-${index + 1}.${extension}"/>`;
  }).join("");
  return xml.replace("</Relationships>", `${additions}</Relationships>`);
}

async function appendImagesToDocxPackage(zip: JSZip, options: DocxMergeOptions): Promise<void> {
  const images = options.imageAppendices ?? [];
  if (!images.length) return;

  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (documentXml) {
    zip.file("word/document.xml", appendImageAppendicesToDocumentXml(documentXml, images));
  }

  const relationshipsPath = "word/_rels/document.xml.rels";
  const existingRelationships = await zip.file(relationshipsPath)?.async("string");
  zip.file(
    relationshipsPath,
    addImageRelationships(existingRelationships ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>', images),
  );

  const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypes) {
    zip.file("[Content_Types].xml", addImageDefaultsToContentTypes(contentTypes, images));
  }

  images.forEach((image, index) => {
    const extension = image.contentType === "image/png" ? "png" : "jpg";
    zip.file(`word/media/newgen-evidence-${index + 1}.${extension}`, image.data);
  });
}

export async function mergeDocxTemplate(
  template: ArrayBuffer,
  fields: MergeFields,
  options: DocxMergeOptions = {},
): Promise<DocxMergeResult> {
  const zip = await JSZip.loadAsync(template);
  const validation = await validateDocxTemplate(template, fields);
  const xmlFiles = await readTemplateXmlFiles(zip);
  let replacedPlaceholders = 0;

  await Promise.all(
    Object.entries(xmlFiles).map(async ([path, xml]) => {
      const transformedXml = applyTemplateTransformations(xml, options, path === "word/document.xml");
      replacedPlaceholders += countReplaceablePlaceholdersInXml(transformedXml, fields);
      const mergedXml = mergePlaceholdersInXml(transformedXml, fields);
      let formattedXml = mergedXml;
      if (path === "word/document.xml" && options.affidavitFormatting) {
        formattedXml = applyAffidavitFormatting(formattedXml, options.affidavitFormatting);
      }
      if (path === "word/document.xml" && options.parentingApplicantName) {
        formattedXml = applyParentingFormatting(formattedXml, options.parentingApplicantName);
      }
      zip.file(path, formattedXml);
    }),
  );

  await appendImagesToDocxPackage(zip, options);

  if (options.outputType === "document") {
    const contentTypes = zip.file("[Content_Types].xml");
    if (contentTypes) {
      zip.file("[Content_Types].xml", convertTemplateContentTypesToDocument(await contentTypes.async("string")));
    }
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });

  return {
    buffer,
    report: {
      ...validation,
      replacedPlaceholders,
      structure: await validateDocxStructure(template, buffer, fields, options),
    },
  };
}
