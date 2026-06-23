import type { MatterFile } from "./matter";
import { formatDateForForms } from "./document-automation";

export const legalAidMatterStorageKey = "newgenautomation:draftMatter";
export const recentMattersStorageKey = "newgenautomation:recentMatters";

export type LegalAidStatus =
  | "draft"
  | "pending_income_proof"
  | "pending_signed_page"
  | "ready_to_generate"
  | "generated"
  | "submitted";

export type LegalAidReview = {
  matterId: string;
  clientName: string;
  dob: string;
  homeAddress: string;
  lawyerPostalAddress: string;
  mobilePhone: string;
  email: string;
  numberOfChildren: string;
  courtLocation: string;
  proceedingsType: string;
  protectionOrderWording: string;
  parentingOrderWording: string;
  abuseSummary: string;
  dateToday: string;
};

export type LegalAidRecord = {
  id: string;
  matterId: string;
  clientName: string;
  status: LegalAidStatus;
  review: LegalAidReview;
  hasIncomeProof: boolean;
  hasSignedPage: boolean;
  incomeProofPath: string;
  signedPagePath: string;
  incomeProofFileName: string;
  signedPageFileName: string;
  templatePath: string;
  createdAt: string;
  updatedAt: string;
};

export type LegalAidPendingSummary = Pick<
  LegalAidRecord,
  "id" | "clientName" | "status" | "hasIncomeProof" | "hasSignedPage" | "updatedAt"
>;

export const legalAidTemplatePath = "templates/Legal Aid Template.pdf";

export const confidentialLawyerPostalAddress = [
  "C/o Example Family Law",
  "PO Box 1000",
  "Auckland",
].join(", ");

export const protectionOrderStandardWording =
  "The Respondent has been abusive to the Applicant. It is serious violence. She and the children need urgent protection. It includes physical and psychological abuse.";

export const parentingOrderStandardWording =
  "Also the Applicant needs to ensure that the respondent can not take the children and not return them. Due to his violence there needs to be a parenting order ensuring that his contact is supervised only. The Respondent is her ex-partner.";

function includesApplication(matter: MatterFile, text: string): boolean {
  return matter.intake.selectedApplications.some((application) =>
    application.toLowerCase().includes(text),
  );
}

function summarizeAbuse(matter: MatterFile): string {
  const notes = [
    matter.intake.domesticViolenceNotes.recentEvents,
    matter.intake.domesticViolenceNotes.history,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!notes) return "";

  const sentences = notes
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return (sentences.length ? sentences.slice(0, 2).join(" ") : notes)
    .slice(0, 420)
    .trim();
}

function buildProceedingsType(matter: MatterFile): string {
  const applications = matter.intake.selectedApplications;
  if (!applications.length) return "";

  const label = applications
    .map((application) => application.replace(/^Without Notice Application for /i, ""))
    .join(", ");

  const isWithoutNotice = applications.some((application) =>
    /without notice/i.test(application),
  );

  return isWithoutNotice ? `Without notice ${label}` : label;
}

function formatInputDate(value: string): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function buildLegalAidReview(matter: MatterFile): LegalAidReview {
  const isConfidentialAddress = Boolean(matter.intake.applicant.isAddressConfidential);
  const isProtectionOrder = includesApplication(matter, "protection order");
  const isParentingOrder = includesApplication(matter, "parenting order");

  return {
    matterId: matter.id,
    clientName: matter.intake.applicant.fullName || matter.clientName,
    dob: formatInputDate(matter.intake.applicant.dateOfBirth),
    homeAddress: isConfidentialAddress ? "Confidential Address" : matter.intake.applicant.homeAddress,
    lawyerPostalAddress: isConfidentialAddress ? confidentialLawyerPostalAddress : "",
    mobilePhone: matter.intake.applicant.mobilePhone,
    email: matter.intake.applicant.emailAddress,
    numberOfChildren: matter.intake.children.length ? String(matter.intake.children.length) : "",
    courtLocation: matter.intake.courtLocation,
    proceedingsType: buildProceedingsType(matter),
    protectionOrderWording: isProtectionOrder ? protectionOrderStandardWording : "",
    parentingOrderWording: isParentingOrder ? parentingOrderStandardWording : "",
    abuseSummary: isProtectionOrder ? summarizeAbuse(matter) : "",
    dateToday: formatDateForForms(),
  };
}

export function getLegalAidStatus(hasIncomeProof: boolean, hasSignedPage: boolean): LegalAidStatus {
  if (!hasIncomeProof) return "pending_income_proof";
  if (!hasSignedPage) return "pending_signed_page";
  return "ready_to_generate";
}
