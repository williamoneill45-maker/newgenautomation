import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
import { sendClientInductionAgreement } from "../../../../lib/adobeSign";
import {
  ensureOneDriveFolder,
  getOneDriveClientFolderPaths,
} from "../../../../lib/onedrive";
import { updateBillingClientInductionInSupabase } from "../../../../lib/supabase-billing";

export const runtime = "nodejs";

type StartInductionRequest = {
  client: BillingClientProfile;
  clientEmail?: string;
  applicationType?: BillingClientProfile["applicationType"];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StartInductionRequest;
    const client = body.client;
    const clientName = client?.clientName?.trim() ?? "";
    const legalAidNumber = client?.legalAidNumber?.trim() ?? "";
    const clientEmail = body.clientEmail?.trim() ?? client?.clientEmail?.trim() ?? "";
    const applicationType = body.applicationType ?? client?.applicationType ?? "";

    if (!client?.id || !clientName) {
      return NextResponse.json(
        { error: "Client id and name are required before induction can start." },
        { status: 400 },
      );
    }

    if (!clientEmail) {
      return NextResponse.json(
        { error: "Client email is required before induction and signing automation can be requested." },
        { status: 400 },
      );
    }

    if (!applicationType) {
      return NextResponse.json(
        { error: "Choose Parenting, Protection, or Both before starting induction." },
        { status: 400 },
      );
    }

    const folderPaths = getOneDriveClientFolderPaths({ clientName, legalAidNumber });
    const createdClientFolder = await ensureOneDriveFolder(folderPaths.clientFolderPath);

    if (createdClientFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for induction folders.", missing: createdClientFolder.missing },
        { status: 503 },
      );
    }

    const formsFolder = await ensureOneDriveFolder(folderPaths.formsFolderPath);
    const billingFolder = await ensureOneDriveFolder(folderPaths.billingFolderPath);

    if (formsFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for the Forms and Induction folder.", missing: formsFolder.missing },
        { status: 503 },
      );
    }
    if (billingFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for the Billing folder.", missing: billingFolder.missing },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
    let adobeUpdates: Partial<BillingClientProfile> = {
      adobeAgreementStatus: client.adobeAgreementStatus ?? "not_sent",
      adobeAgreementName: client.adobeAgreementName ?? `Information to Client - ${clientName}`,
    };

    if (!client.adobeAgreementId) {
      try {
        const agreement = await sendClientInductionAgreement({
          clientName,
          clientEmail,
          applicationType,
        });
        adobeUpdates = {
          adobeAgreementId: agreement.agreementId,
          adobeAgreementStatus: agreement.status,
          adobeAgreementSentAt: agreement.sentAt,
          adobeAgreementName: agreement.agreementName,
          adobeAgreementError: "",
          engagementStatus: "sent",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Adobe induction agreement could not be sent.";
        console.error("Adobe induction agreement send failed during induction start", {
          clientId: client.id,
          clientName,
          reason: message,
        });
        adobeUpdates = {
          adobeAgreementStatus: "error",
          adobeAgreementName: `Information to Client - ${clientName}`,
          adobeAgreementError: message,
          engagementStatus: "failed",
        };
      }
    }

    const updatedClient: BillingClientProfile = {
      ...client,
      clientEmail,
      applicationType,
      oneDriveClientFolderPath: folderPaths.clientFolderPath,
      oneDriveFormsFolderPath: folderPaths.formsFolderPath,
      oneDriveBillingFolderPath: folderPaths.billingFolderPath,
      oneDriveClientFolderUrl: createdClientFolder.webUrl,
      engagementStatus: client.engagementStatus ?? "not_started",
      msdRequestStatus: "not_started",
      legalAidApplicationStatus: "pending_signed_forms_and_msd",
      requiredDocumentOneUploaded: client.requiredDocumentOneUploaded ?? false,
      requiredDocumentTwoUploaded: client.requiredDocumentTwoUploaded ?? false,
      inductionRequestedAt: now,
      ...adobeUpdates,
      updatedAt: now,
    };

    try {
      await updateBillingClientInductionInSupabase(updatedClient);
    } catch (error) {
      console.error("Client induction metadata save failed after OneDrive/Adobe setup", {
        clientId: updatedClient.id,
        reason: error instanceof Error ? error.message : "Unknown Supabase save error",
      });
    }

    return NextResponse.json({
      status: "started",
      client: updatedClient,
      folders: {
        clientFolderPath: folderPaths.clientFolderPath,
        formsFolderPath: folderPaths.formsFolderPath,
        billingFolderPath: folderPaths.billingFolderPath,
      },
      signing: {
        status: updatedClient.adobeAgreementStatus,
        agreementId: updatedClient.adobeAgreementId,
        message: updatedClient.adobeAgreementStatus === "sent"
          ? "Adobe induction agreement sent to the client."
          : updatedClient.adobeAgreementError || "Adobe induction agreement was not sent.",
      },
    });
  } catch (error) {
    console.error("Client induction start failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start client induction." },
      { status: 500 },
    );
  }
}
