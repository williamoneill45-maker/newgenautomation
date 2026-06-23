import type { BillingClientProfile, StoredBillingInvoice } from "./billing-storage";
import type { LegalAidClaim } from "./legal-aid-claims";
import type { LegalAidRecord } from "./legal-aid";
import type { MatterFile } from "./matter";

export const isDemoEnvironment = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const now = new Date();
const isoToday = now.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
const daysAgo = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
};

export const demoMatter: MatterFile = {
  id: "matter-demo-thompson-roberts",
  clientName: "SARAH THOMPSON",
  legalAidNumber: "100100100",
  legalAidRequired: true,
  status: "documents_generated",
  createdAt: `${daysAgo(3)}T09:00:00.000Z`,
  updatedAt: `${isoToday}T09:30:00.000Z`,
  intake: {
    selectedApplications: [
      "Without Notice Application for Protection Order",
      "Without Notice Application for Parenting Order",
    ],
    proceedingsType: "both",
    otherApplicationDetails: "",
    courtLocation: "Auckland Court",
    famNumber: "FAM-2026-404-000101",
    msdClientNumber: "MSD-EXAMPLE-1001",
    applicant: {
      id: "applicant-demo",
      matterId: "matter-demo-thompson-roberts",
      role: "applicant",
      fullName: "SARAH THOMPSON",
      dateOfBirth: "1989-05-14",
      gender: "F",
      occupation: "Office administrator",
      mobilePhone: "021 555 0101",
      emailAddress: "sarah.thompson@example.com",
      homeAddress: "14 Example Street, Auckland 1010",
      workAddress: "",
      ethnicity: "New Zealand European",
      otherEthnicity: "",
      relationshipToApplicant: "",
      isAddressConfidential: true,
    },
    respondent: {
      id: "respondent-demo",
      matterId: "matter-demo-thompson-roberts",
      role: "respondent",
      fullName: "MICHAEL ROBERTS",
      dateOfBirth: "1987-09-22",
      gender: "M",
      occupation: "Builder",
      mobilePhone: "021 555 0102",
      emailAddress: "michael.roberts@example.com",
      homeAddress: "28 Sample Road, Auckland 1021",
      workAddress: "Example Construction Ltd, Auckland",
      ethnicity: "New Zealand European",
      otherEthnicity: "",
      relationshipToApplicant: "Former partner",
    },
    relationship: {
      marriageOrCivilUnionDate: "",
      marriageOrCivilUnionPlace: "",
      deFactoRelationshipStart: "2015-02-01",
      relationshipEndDate: "2026-05-20",
    },
    children: [
      {
        id: "child-demo-1",
        matterId: "matter-demo-thompson-roberts",
        fullName: "EMILY ROBERTS",
        age: "8",
        dateOfBirth: "2018-03-11",
        gender: "F",
        livingWithName: "SARAH THOMPSON",
        livingWithRelationshipToChild: "Mother",
        applicantRelationshipToChild: "Mother",
        respondentRelationshipToChild: "Father",
        ethnicity: "New Zealand European",
        otherEthnicity: "",
      },
      {
        id: "child-demo-2",
        matterId: "matter-demo-thompson-roberts",
        fullName: "JACK ROBERTS",
        age: "5",
        dateOfBirth: "2021-01-19",
        gender: "M",
        livingWithName: "SARAH THOMPSON",
        livingWithRelationshipToChild: "Mother",
        applicantRelationshipToChild: "Mother",
        respondentRelationshipToChild: "Father",
        ethnicity: "New Zealand European",
        otherEthnicity: "",
      },
    ],
    proceedings: {
      previousApplications: "None known.",
      existingOrdersBetweenParties: "None known.",
      existingOrdersRelatingToChildren: "None known.",
    },
    domesticViolenceNotes: { history: "", recentEvents: "" },
  },
};

export const demoClient: BillingClientProfile = {
  id: "client-sarah-thompson",
  clientName: "SARAH THOMPSON",
  legalAidNumber: "100100100",
  famNumber: "FAM-2026-404-000101",
  clientEmail: "sarah.thompson@example.com",
  applicationType: "both",
  requiredDocumentOneUploaded: true,
  requiredDocumentTwoUploaded: true,
  msdRequestStatus: "received",
  legalAidApplicationStatus: "ready_to_generate",
  createdAt: demoMatter.createdAt,
  updatedAt: demoMatter.updatedAt,
};

export const demoLegalAidApplications: LegalAidRecord[] = [
  {
    id: "legal-aid-matter-demo-thompson-roberts",
    matterId: demoMatter.id,
    clientName: demoClient.clientName,
    status: "ready_to_generate",
    review: {
      matterId: demoMatter.id,
      clientName: demoClient.clientName,
      dob: "14/05/1989",
      homeAddress: "Confidential Address",
      lawyerPostalAddress: "C/o lawyer, Auckland",
      mobilePhone: demoMatter.intake.applicant.mobilePhone,
      email: demoMatter.intake.applicant.emailAddress,
      numberOfChildren: "2",
      courtLocation: "Auckland Court",
      proceedingsType: "Without notice Protection Order, Parenting Order",
      protectionOrderWording: "Protection Order required.",
      parentingOrderWording: "Parenting Order required.",
      abuseSummary: "",
      dateToday: isoToday,
    },
    hasIncomeProof: true,
    hasSignedPage: true,
    incomeProofPath: "demo/income-proof.pdf",
    signedPagePath: "demo/signed-page-5.pdf",
    incomeProofFileName: "income-proof-example.pdf",
    signedPageFileName: "signed-page-5-example.pdf",
    templatePath: "templates/Legal Aid Template.pdf",
    createdAt: demoMatter.createdAt,
    updatedAt: demoMatter.updatedAt,
  },
];

export const demoClaims: LegalAidClaim[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    firmId: "demo-firm",
    claimId: "CLAIM-202606-32B-001",
    clientName: "SARAH THOMPSON",
    legalAidNumber: "100100100",
    matterName: "Thompson v Roberts – Protection and Parenting",
    formType: "32B",
    amountClaimed: 931.5,
    dateGenerated: daysAgo(18),
    dateSent: daysAgo(17),
    lifecycleStatus: "Sent",
    paidStatus: "Part Paid",
    datePaid: daysAgo(6),
    amountPaid: 400,
    outstandingAmount: 531.5,
    storageProvider: "OneDrive",
    storageLocation: "NewGenAutomation/Clients/THOMPSON Sarah/Billing",
    notes: "Part payment received; follow up on balance.",
    createdAt: `${daysAgo(18)}T02:00:00.000Z`,
    updatedAt: `${daysAgo(6)}T02:00:00.000Z`,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    firmId: "demo-firm",
    claimId: "CLAIM-202606-33A-002",
    clientName: "SARAH THOMPSON",
    legalAidNumber: "100100100",
    matterName: "Thompson v Roberts – Protection and Parenting",
    formType: "33A",
    amountClaimed: 494.5,
    dateGenerated: daysAgo(3),
    dateSent: daysAgo(2),
    lifecycleStatus: "Sent",
    paidStatus: "Unpaid",
    datePaid: "",
    amountPaid: 0,
    outstandingAmount: 494.5,
    storageProvider: "Computer",
    storageLocation: "Downloaded form",
    notes: "",
    createdAt: `${daysAgo(3)}T02:00:00.000Z`,
    updatedAt: `${daysAgo(2)}T02:00:00.000Z`,
  },
];

export const demoInvoices: StoredBillingInvoice[] = [];
