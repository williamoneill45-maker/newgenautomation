import { notFound } from "next/navigation";

import { demoMatter } from "../../../../lib/demo-data";
import { readDocxVisibleText, scanTemplateFile } from "../../../../lib/template-scanner";
import { getTemplateManifest } from "../../../../lib/supabase-template-versions";
import {
  getStudioTemplate,
  readTemplateSource,
  templateAppliesToMatter,
} from "../../../../lib/template-studio";
import { TemplateStudioClient } from "./_components/TemplateStudioClient";

export default async function TemplateStudioPage({
  params,
}: {
  params: Promise<{ studioId: string }>;
}) {
  const { studioId } = await params;
  const template = getStudioTemplate(studioId);
  if (!template) notFound();

  const sourcePath = `${process.cwd()}/templates/${template.sourceFileName}`;
  const report = await scanTemplateFile(sourcePath);
  const manifest = await getTemplateManifest(template);
  const source = template.kind === "docx" && report.exists
    ? await readTemplateSource(template)
    : null;
  const previewText = source ? await readDocxVisibleText(source) : "";
  const applicability = templateAppliesToMatter(template, demoMatter);

  return (
    <TemplateStudioClient
      template={template}
      previewText={previewText}
      placeholders={report.placeholders}
      manifest={manifest}
      initialApplies={applicability.applies}
      initialReason={applicability.reason}
    />
  );
}
