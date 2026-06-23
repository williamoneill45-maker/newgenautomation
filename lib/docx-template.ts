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
  continuationSections?: Array<{ heading: string; lines: string[]; pageBreak?: boolean }>;
};

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
      .map((value) => replaceParagraphText(paragraph, value.trim()))
      .join("");
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

function applyTemplateTransformations(xml: string, options: DocxMergeOptions, isMainDocument = false): string {
  let output = xml;
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
      zip.file(path, mergePlaceholdersInXml(transformedXml, fields));
    }),
  );

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
