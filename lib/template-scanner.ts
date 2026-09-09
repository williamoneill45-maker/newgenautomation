import path from "node:path";
import { access, readFile, readdir } from "node:fs/promises";

import JSZip from "jszip";

import { canonicalTemplateFieldSet, legacyTemplateAliasMap } from "./template-fields";

export type TemplatePlaceholder = {
  raw: string;
  key: string;
  canonicalKey?: string;
  status: "known" | "legacy" | "unknown" | "malformed";
  issue?: string;
};

export type TemplateScanReport = {
  fileName: string;
  sourcePath: string;
  exists: boolean;
  fileType: "docx" | "doc" | "pdf" | "other";
  canScan: boolean;
  placeholders: TemplatePlaceholder[];
  knownPlaceholders: string[];
  legacyPlaceholders: TemplatePlaceholder[];
  unknownPlaceholders: TemplatePlaceholder[];
  malformedPlaceholders: TemplatePlaceholder[];
  recommendations: string[];
};

export function getTemplateFileType(fileName: string): TemplateScanReport["fileType"] {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".docx") return "docx";
  if (extension === ".doc") return "doc";
  if (extension === ".pdf") return "pdf";
  return "other";
}

export async function scanTemplateFile(sourcePath: string): Promise<TemplateScanReport> {
  const fileName = path.basename(sourcePath);
  const fileType = getTemplateFileType(fileName);
  const exists = await fileExists(sourcePath);

  if (!exists) {
    return makeReport({
      fileName,
      sourcePath,
      exists,
      fileType,
      canScan: false,
      placeholders: [],
      recommendations: ["Upload or restore this template before activating the document rule."],
    });
  }

  if (fileType !== "docx") {
    return makeReport({
      fileName,
      sourcePath,
      exists,
      fileType,
      canScan: false,
      placeholders: [],
      recommendations: fileType === "doc"
        ? ["Convert this legacy .doc file to .docx before using Template Studio validation."]
        : ["This file type cannot be scanned for DOCX placeholders."],
    });
  }

  try {
    const buffer = await readFile(sourcePath);
    const placeholders = await scanDocxBuffer(buffer);

    return makeReport({
      fileName,
      sourcePath,
      exists,
      fileType,
      canScan: true,
      placeholders,
      recommendations: buildRecommendations(fileType, placeholders),
    });
  } catch (error) {
    return makeReport({
      fileName,
      sourcePath,
      exists,
      fileType,
      canScan: false,
      placeholders: [],
      recommendations: [`Unable to scan DOCX: ${error instanceof Error ? error.message : "unknown error"}`],
    });
  }
}

export async function scanDocxBuffer(buffer: Buffer | ArrayBuffer): Promise<TemplatePlaceholder[]> {
  const zip = await JSZip.loadAsync(buffer);
  const textParts: string[] = [];

  await Promise.all(
    Object.keys(zip.files)
      .filter((name) => (
        name.startsWith("word/") &&
        name.endsWith(".xml") &&
        !zip.files[name].dir
      ))
      .map(async (name) => {
        const xml = await zip.files[name].async("string");
        textParts.push(readVisibleWordXmlText(xml));
      }),
  );

  return extractPlaceholders(textParts.join("\n"));
}

export async function scanTemplateDirectory(templateDirectory: string): Promise<TemplateScanReport[]> {
  const files = (await listTemplateFiles(templateDirectory))
    .filter((filePath) => {
      const type = getTemplateFileType(filePath);
      return type === "docx" || type === "doc" || type === "pdf";
    })
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(files.map((filePath) => scanTemplateFile(filePath)));
}

async function listTemplateFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listTemplateFiles(entryPath);
      if (entry.isFile()) return [entryPath];
      return [];
    }),
  );

  return files.flat();
}

export function extractPlaceholders(text: string): TemplatePlaceholder[] {
  const found = new Map<string, TemplatePlaceholder>();
  const completePattern = /\{\{([^{}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = completePattern.exec(text))) {
    const raw = match[0];
    const key = match[1].trim();
    found.set(raw, classifyPlaceholder(raw, key));
  }

  const malformedPattern = /\{\{[^{}\n]*(?:\}?(?!\})|$)|(?<!\{)\}\}/g;
  for (const malformed of text.match(malformedPattern) ?? []) {
    if (!found.has(malformed)) {
      found.set(malformed, {
        raw: malformed,
        key: malformed.replace(/^\{\{/, "").replace(/\}\}$/, "").trim(),
        status: "malformed",
        issue: "Malformed placeholder braces.",
      });
    }
  }

  return Array.from(found.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function classifyPlaceholder(raw: string, key: string): TemplatePlaceholder {
  if (raw !== `{{${key}}}` || /\s/.test(key)) {
    return {
      raw,
      key,
      status: "malformed",
      issue: "Use exact double braces with no spaces inside the field name.",
    };
  }

  if (canonicalTemplateFieldSet.has(key)) {
    return { raw, key, status: "known" };
  }

  const legacyAlias = legacyTemplateAliasMap.get(key);
  if (legacyAlias) {
    return {
      raw,
      key,
      canonicalKey: legacyAlias.canonical,
      status: "legacy",
      issue: legacyAlias.reason,
    };
  }

  return {
    raw,
    key,
    status: "unknown",
    issue: "No matching field exists in the canonical NewGen field dictionary.",
  };
}

function makeReport(input: {
  fileName: string;
  sourcePath: string;
  exists: boolean;
  fileType: TemplateScanReport["fileType"];
  canScan: boolean;
  placeholders: TemplatePlaceholder[];
  recommendations: string[];
}): TemplateScanReport {
  const knownPlaceholders = input.placeholders
    .filter((placeholder) => placeholder.status === "known")
    .map((placeholder) => placeholder.key);
  const legacyPlaceholders = input.placeholders.filter((placeholder) => placeholder.status === "legacy");
  const unknownPlaceholders = input.placeholders.filter((placeholder) => placeholder.status === "unknown");
  const malformedPlaceholders = input.placeholders.filter((placeholder) => placeholder.status === "malformed");

  return {
    ...input,
    knownPlaceholders,
    legacyPlaceholders,
    unknownPlaceholders,
    malformedPlaceholders,
  };
}

function buildRecommendations(
  fileType: TemplateScanReport["fileType"],
  placeholders: TemplatePlaceholder[],
): string[] {
  const recommendations: string[] = [];
  const legacy = placeholders.filter((placeholder) => placeholder.status === "legacy");
  const unknown = placeholders.filter((placeholder) => placeholder.status === "unknown");
  const malformed = placeholders.filter((placeholder) => placeholder.status === "malformed");

  if (fileType === "doc") {
    recommendations.push("Convert this legacy .doc file to .docx.");
  }

  if (malformed.length > 0) {
    recommendations.push("Fix malformed placeholders before activating this template.");
  }

  if (unknown.length > 0) {
    recommendations.push("Map unknown placeholders to canonical NewGen fields or add a new field definition.");
  }

  if (legacy.length > 0) {
    recommendations.push("Replace legacy aliases with lowercase snake_case canonical fields.");
  }

  if (recommendations.length === 0) {
    recommendations.push("No placeholder blocker found.");
  }

  return recommendations;
}

function readVisibleWordXmlText(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
