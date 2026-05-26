import JSZip from "jszip";

export const inductionInstructionsFileName = "instructions.docx";

export type InductionInstructionsInput = {
  clientName: string;
  clientEmail: string;
  legalAidNumber: string;
  applicationType: string;
  fileCreatedTimestamp: string;
  clientFolderPath: string;
  formsFolderPath: string;
  billingFolderPath: string;
  documentsGenerated: boolean;
  msdRequestFileName: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function fieldParagraph(label: string, value: string | boolean): string {
  return paragraph(`${label}: ${String(value)}`);
}

export async function buildInductionInstructionsDocx(input: InductionInstructionsInput): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph("Induction Instructions")}
    ${fieldParagraph("clientName", input.clientName)}
    ${fieldParagraph("clientEmail", input.clientEmail)}
    ${fieldParagraph("legalAidNumber", input.legalAidNumber)}
    ${fieldParagraph("applicationType", input.applicationType)}
    ${fieldParagraph("fileCreatedTimestamp", input.fileCreatedTimestamp)}
    ${fieldParagraph("documentsGenerated", input.documentsGenerated)}
    ${fieldParagraph("msdRequestFileName", input.msdRequestFileName)}
    ${fieldParagraph("clientFolderPath", input.clientFolderPath)}
    ${fieldParagraph("formsFolderPath", input.formsFolderPath)}
    ${fieldParagraph("billingFolderPath", input.billingFolderPath)}
    ${fieldParagraph("adobeRecipientName", input.clientName)}
    ${fieldParagraph("adobeRecipientEmail", input.clientEmail)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word")?.file("document.xml", documentXml);

  return zip.generateAsync({ type: "arraybuffer" });
}
