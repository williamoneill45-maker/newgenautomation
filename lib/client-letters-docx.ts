import JSZip from "jszip";

import type { MatterFile } from "./matter";

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraph(text = ""): string {
  return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function heading(text: string): string {
  return `<w:p><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

async function buildDocx(bodyXml: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
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
  zip.folder("word")?.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

export async function buildLetterOfEngagementDocx(matter: MatterFile): Promise<ArrayBuffer> {
  const applicant = clean(matter.intake.applicant.fullName || matter.clientName) || "Client";
  const respondent = clean(matter.intake.respondent.fullName) || "the Respondent";
  return buildDocx([
    heading("LETTER OF ENGAGEMENT"),
    paragraph(`Client: ${applicant}`),
    paragraph(`Matter: ${applicant} v ${respondent}`),
    paragraph(`Legal Aid number: ${clean(matter.legalAidNumber) || "To be confirmed"}`),
    paragraph(),
    paragraph("We confirm that Natalie Quirke is instructed to act for you in your Family Court matter."),
    paragraph("This letter records the engagement for the preparation, filing, and service of the documents required for your application."),
    paragraph("Please review the accompanying client information and contact us if any detail is incorrect before the documents are filed."),
  ].join(""));
}

export async function buildInformationToClientDocx(matter: MatterFile): Promise<ArrayBuffer> {
  const applicant = clean(matter.intake.applicant.fullName || matter.clientName) || "Client";
  return buildDocx([
    heading("INFORMATION TO CLIENT"),
    paragraph(`Client: ${applicant}`),
    paragraph(),
    paragraph("Please read the documents carefully before signing. The documents must be true and complete to the best of your knowledge."),
    paragraph("If your address is confidential, do not provide your residential address for service unless you have discussed this with your lawyer."),
    paragraph("If you receive any communication from the Court, Police, Legal Aid, or the other party, please forward it to us promptly."),
    paragraph("Keep copies of all documents, screenshots, Police safety orders, bail conditions, and correspondence that may support your application."),
  ].join(""));
}
