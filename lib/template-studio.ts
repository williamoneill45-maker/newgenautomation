import { buildAdditionalChildLines } from "./child-continuation";
import { buildTemplateMergeFields, getInformationSheetEthnicityCheckboxes } from "./document-automation";
import { mergeDocxTemplate, type DocxMergeReport, type DocxMergeOptions } from "./docx-template";
import {
  buildCourtLetterDocxLiteralReplacements,
  buildCourtLetterDocxMergeFields,
  formatTodayLong,
} from "./legacy-doc-template";
import type { MatterFile } from "./matter";
import {
  confidentialAddressInformationSheet,
  standardDocxTemplates,
  type SourceTemplateDefinition,
} from "./template-catalog";
import {
  buildAffidavitMergeFields,
  buildStandardAffidavitContent,
  isParentingOrderSought,
  isProtectionOrderSought,
  isTenancyOrderSought,
  isAncillaryFurnitureOrderSought,
  validateAffidavitApplicationSelection,
} from "./standard-affidavit";
import { resolveTemplateSource } from "./template-resolver";

export type StudioTemplateDefinition = SourceTemplateDefinition & {
  studioId: string;
  kind: "docx" | "pdf";
  sourceDescription: string;
};

export const studioTemplates: StudioTemplateDefinition[] = [
  ...standardDocxTemplates.map((template, index) => ({
    ...template,
    studioId: String(index),
    kind: "docx" as const,
    sourceDescription: "DOCX merge template",
  })),
  {
    id: "legal_aid_application",
    title: "Legal Aid Application",
    sourceFileName: "Legal Aid Template.pdf",
    outputFileName: "Legal Aid Application.pdf",
    studioId: "legal-aid-application",
    kind: "pdf",
    sourceDescription: "PDF fillable form",
  },
  {
    id: "confidential_address_application",
    title: confidentialAddressInformationSheet.title,
    sourceFileName: confidentialAddressInformationSheet.sourceFileName,
    outputFileName: confidentialAddressInformationSheet.outputFileName,
    studioId: "confidential-address-information-sheet",
    kind: "pdf",
    sourceDescription: "PDF fillable form",
  },
];

const courtLetterDocumentTypes = new Set([
  "court_legal_aid_confirmation_letter",
  "court_filing_documents_letter",
  "court_filing_dv_applications_letter",
  "mfi_service_letter",
  "police_information_request_email",
  "registrar_list_submissions",
]);

export function getStudioTemplate(studioId: string): StudioTemplateDefinition | undefined {
  return studioTemplates.find((template) => template.studioId === studioId);
}

export function getStudioTemplateForSource(template: SourceTemplateDefinition): StudioTemplateDefinition {
  return studioTemplates.find((item) =>
    item.sourceFileName === template.sourceFileName &&
    item.outputFileName === template.outputFileName
  ) ?? {
    ...template,
    studioId: template.outputFileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    kind: template.sourceFileName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx",
    sourceDescription: "Repository template",
  };
}

export async function readTemplateSource(template: StudioTemplateDefinition): Promise<ArrayBuffer> {
  return (await resolveTemplateSource(template)).buffer;
}

export async function generateStudioDocxPreview(
  template: StudioTemplateDefinition,
  matter: MatterFile,
  options: { versionId?: string } = {},
): Promise<{ buffer: ArrayBuffer; report: DocxMergeReport }> {
  if (template.kind !== "docx") {
    throw new Error("Only DOCX templates can be test-generated from Template Studio.");
  }

  const sourceTemplate = (await resolveTemplateSource(template, { versionId: options.versionId })).buffer;
  if (template.id === "domestic_violence_affidavit") {
    const validationError = validateAffidavitApplicationSelection(matter);
    if (validationError) throw new Error(validationError);
  }
  const affidavitContent = buildStandardAffidavitContent(matter);
  const affidavitMergeFields = buildAffidavitMergeFields(matter, affidavitContent);
  const isCourtLetter = courtLetterDocumentTypes.has(template.id);
  const fields = {
    ...buildTemplateMergeFields(matter, template.id),
    ...(isCourtLetter ? buildCourtLetterDocxMergeFields(matter) : {}),
    ...informationSheetApplicationFields(template),
    ...(template.id === "confidential_address_application"
      ? {
          APPLICANT_ADDRESS: matter.intake.applicant.homeAddress,
          applicant_home_address: matter.intake.applicant.homeAddress,
        }
      : {}),
    ...(template.id === "domestic_violence_affidavit"
      ? {
          affidavit_application_title: affidavitContent.applicationTitle,
          relationship_start_blurb: affidavitContent.relationshipStartBlurb,
          relationship_end: affidavitContent.relationshipEnd,
          relationship_end_blurb: affidavitContent.relationshipEnd,
          violence_categories: "",
          insert_history_blurb: "",
          insert_recent_events_blurb: "",
          children_blurb: "",
          protection_facts_heading: "",
          application_intro: affidavitContent.applicationIntro,
          without_notice_heading: "",
          without_notice_intro: "",
          without_notice_safety: "",
          parenting_heading: "",
          parenting_blurb: "",
          orders_sought_blurb: "",
          affidavit_signing_location: "",
          ...affidavitMergeFields,
        }
      : {}),
  };

  return mergeDocxTemplate(sourceTemplate, fields, buildStudioMergeOptions(template, matter, affidavitContent));
}

function informationSheetApplicationFields(template: StudioTemplateDefinition) {
  if (template.id !== "information_sheet") return {};
  const application = template.title.includes("(COCA)")
    ? "Without Notice Application for Parenting Order"
    : "Without Notice Application for Protection Order";

  return {
    APPLICATION_TYPE_1: application,
    APPLICATION_TYPE_2: "",
    APPLICATION_TYPE_3: "",
    application_type_1: application,
    application_type_2: "",
    application_type_3: "",
  };
}

function buildStudioMergeOptions(
  template: StudioTemplateDefinition,
  matter: MatterFile,
  affidavitContent: ReturnType<typeof buildStandardAffidavitContent>,
): DocxMergeOptions {
  const isCourtLetter = courtLetterDocumentTypes.has(template.id);

  return {
    ...(template.id === "confidential_address_application"
      ? { removeFirstExplicitPageBreak: true }
      : {}),
    ...(template.id === "parenting_order_application"
      ? {
          literalTextReplacements: {
            "I {{APPLICANT_FIRST_NAME}},": "I {{APPLICANT_NAME}},",
          },
          parentingApplicantName: matter.intake.applicant.fullName.toLocaleUpperCase("en-NZ"),
          childCount: Math.min(matter.intake.children.length, 3),
          repeatChildParagraphsThrough: matter.intake.children.length,
        }
      : {}),
    ...(template.id === "protection_order_application"
      ? {
          protectionOrderShineApplicantName: matter.intake.applicant.fullName.toLocaleUpperCase("en-NZ"),
          normalizeProtectionOrderLayout: true,
          literalTextReplacements: {
            "{{RESPONDENT_NAME}} - currently working with Shine.": "{{APPLICANT_NAME}} - currently working with Shine.",
          },
        }
      : {}),
    ...(template.id === "information_sheet"
      ? {
          childCount: Math.min(matter.intake.children.length, 3),
          informationSheetApplicationCount: 1,
          informationSheetEthnicityCheckboxes: [
            getInformationSheetEthnicityCheckboxes(matter.intake.applicant.ethnicity),
            getInformationSheetEthnicityCheckboxes(matter.intake.respondent.ethnicity),
          ] as [boolean[], boolean[]],
        }
      : {}),
    ...(template.id === "information_sheet" && matter.intake.children.length > 3
      ? {
          continuationSections: [{
            heading: "ADDITIONAL CHILDREN AFFECTED BY THE APPLICATION",
            lines: buildAdditionalChildLines(matter),
          }],
        }
      : {}),
    ...(template.id === "domestic_violence_affidavit"
      ? {
          conditionalBlocks: affidavitContent.conditionalBlocks,
          literalTextReplacements: {
            "AFFIRMED at {{English_court_name}} this": "AFFIRMED at            this",
          },
          affidavitFormatting: {
            applicantName: matter.intake.applicant.fullName.toLocaleUpperCase("en-NZ"),
            respondentName: matter.intake.respondent.fullName.toLocaleUpperCase("en-NZ"),
            childNames: matter.intake.children.map((child) => child.fullName.toLocaleUpperCase("en-NZ")),
            legislationLines: affidavitContent.legislationLines,
          },
          paragraphInsertions: {
            children_blurb: affidavitContent.childrenParagraphs,
            protection_facts_heading: affidavitContent.protectionFactsHeading,
            violence_categories: affidavitContent.violenceCategories,
            insert_history_blurb: [""],
            insert_recent_events_blurb: [""],
            without_notice_heading: affidavitContent.withoutNoticeHeading,
            without_notice_intro: affidavitContent.withoutNoticeIntro,
            without_notice_safety: affidavitContent.withoutNoticeSafetyFactors,
            parenting_heading: affidavitContent.parentingHeading,
            parenting_blurb: affidavitContent.parentingParagraphs,
            orders_sought_blurb: affidavitContent.ordersSoughtParagraphs,
          },
        }
      : {}),
    ...(isCourtLetter
      ? {
          literalTextReplacements: buildCourtLetterDocxLiteralReplacements(matter),
          legacyCourtLetterDate: formatTodayLong(),
        }
      : {}),
  };
}

export function templateAppliesToMatter(template: StudioTemplateDefinition, matter: MatterFile): { applies: boolean; reason: string } {
  if (template.id === "confidential_address_application" && !matter.intake.applicant.isAddressConfidential) {
    return { applies: false, reason: "Turn on confidential address to include this document." };
  }
  if (template.id === "parenting_order_application" && !isParentingOrderSought(matter)) {
    return { applies: false, reason: "Turn on Parenting Order to include this document." };
  }
  if (template.id === "protection_order_application" && !isProtectionOrderSought(matter)) {
    return { applies: false, reason: "Turn on Protection Order to include this document." };
  }
  if (template.id === "domestic_violence_affidavit" && !isProtectionOrderSought(matter) && !isParentingOrderSought(matter)) {
    if (!isTenancyOrderSought(matter) && !isAncillaryFurnitureOrderSought(matter)) {
      return { applies: false, reason: "Select at least one order to include the affidavit." };
    }
  }

  return { applies: true, reason: "Included with the current fake intake settings." };
}
