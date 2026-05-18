import JSZip from "jszip";
import { NextResponse } from "next/server";
import { buildMatterMergeFields } from "../../../lib/document-automation";
import type { MatterFile } from "../../../lib/matter";

export const runtime = "nodejs";

type DemoDocument = {
  fileName: string;
  title: string;
  paragraphs: string[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function value(fields: Record<string, string | undefined>, key: string): string {
  return fields[key] ?? "";
}

function line(label: string, content: string): string {
  return content ? `${label}: ${content}` : `${label}:`;
}

function paragraphXml(text: string, bold = false): string {
  const runs = text.split("\n").map((part) => {
    const properties = bold ? "<w:rPr><w:b/></w:rPr>" : "";
    return `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
  });

  return `<w:p>${runs.join('<w:r><w:br/></w:r>')}</w:p>`;
}

async function createDocx(document: DemoDocument): Promise<Buffer> {
  const zip = new JSZip();
  const body = [
    paragraphXml(document.title, true),
    ...document.paragraphs.map((paragraph) => paragraphXml(paragraph)),
  ].join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

function buildDocuments(matter: MatterFile, affidavitDraft: string): DemoDocument[] {
  const fields = buildMatterMergeFields(matter) as Record<string, string | undefined>;
  const applicant = value(fields, "APPLICANT_NAME");
  const respondent = value(fields, "RESPONDENT_NAME");
  const court = value(fields, "COURT_LOCATION");
  const childName = value(fields, "child_1_name") || value(fields, "CHILD_1_NAME");
  const childDob = value(fields, "child_1_dob") || value(fields, "CHILD_1_DOB");
  const today = value(fields, "date_today");

  const common = [
    line("Date", today),
    line("Court", court),
    line("Applicant", applicant),
    line("Applicant address", value(fields, "applicant_home_address")),
    line("Applicant occupation", value(fields, "applicant_occupation")),
    line("Applicant phone", value(fields, "applicant_phone_number")),
    line("Respondent", respondent),
    line("Respondent address", value(fields, "respondent_home_address")),
    line("Respondent occupation", value(fields, "respondent_occupation")),
    line("Respondent work address", value(fields, "respondent_work_address")),
  ];

  return [
    {
      fileName: "01 Information Sheet.docx",
      title: "Information Sheet",
      paragraphs: [
        ...common,
        line("Child 1", childName),
        line("Child 1 date of birth", childDob),
        line("Child 1 age", value(fields, "CHILD_1_AGE")),
        line("Application type 1", value(fields, "APPLICATION_TYPE_1")),
      ],
    },
    {
      fileName: "02 Application for Confidential Address.docx",
      title: "Application for Confidential Address",
      paragraphs: common,
    },
    {
      fileName: "03 Application for Parenting Order.docx",
      title: "Application for Parenting Order",
      paragraphs: [
        ...common,
        line("Child 1", childName),
        line("Child 1 date of birth", childDob),
        line("Respondent relationship to child", value(fields, "respondents_relationship_to_children")),
      ],
    },
    {
      fileName: "04 Application for Protection Order.docx",
      title: "Application for Protection Order",
      paragraphs: common,
    },
    {
      fileName: "05 Domestic Violence Affidavit.docx",
      title: "Domestic Violence Affidavit",
      paragraphs: [
        line("Applicant", applicant),
        line("Respondent", respondent),
        affidavitDraft || "History of domestic violence and recent events will appear here from the intake notes.",
      ],
    },
    {
      fileName: "06 MSD Request.docx",
      title: "MSD Request",
      paragraphs: [
        line("Applicant", applicant),
        line("Applicant date of birth", value(fields, "applicant_dob")),
        line("Applicant home address", value(fields, "applicant_home_address")),
      ],
    },
    {
      fileName: "07 Police Information Sheet.docx",
      title: "Police Information Sheet",
      paragraphs: [
        ...common,
        line("Respondent date of birth", value(fields, "respondent_dob")),
        line("Respondent age", value(fields, "respondent_age")),
      ],
    },
  ];
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    matter?: MatterFile;
    affidavitDraft?: string;
  };

  if (!body.matter) {
    return NextResponse.json({ error: "Matter data is required." }, { status: 400 });
  }

  const bundle = new JSZip();
  const documents = buildDocuments(body.matter, body.affidavitDraft ?? "");

  for (const document of documents) {
    bundle.file(document.fileName, await createDocx(document));
  }

  const output = await bundle.generateAsync({ type: "nodebuffer" });

  return new NextResponse(output, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="family-court-demo-documents.zip"',
    },
  });
}
