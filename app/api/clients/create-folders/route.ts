import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
import { sendClientInductionAgreement } from "../../../../lib/adobeSign";
import {
  ensureOneDriveFolder,
  getOneDriveClientFolderPaths,
} from "../../../../lib/onedrive";
import { updateBillingClientInductionInSupabase } from "../../../../lib/supabase-billing";

export const runtime = "nodejs";

type CreateFoldersRequest = {
  client: BillingClientProfile;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateFoldersRequest;
    const client = body.client;
    const clientName = client?.clientName?.trim() ?? "";
    const legalAidNumber = client?.legalAidNumber?.trim() ?? "";

    if (!client?.id || !clientName) {
      return NextResponse.json(
        { error: "Client id and name are required before OneDrive folders can be created." },
        { status: 400 },
      );
    }

    const folderPaths = getOneDriveClientFolderPaths({ clientName, legalAidNumber });

    const formsFolder = await ensureOneDriveFolder(folderPaths.formsFolderPath);
    const billingFolder = await ensureOneDriveFolder(folderPaths.billingFolderPath);
    const clientFolder = await ensureOneDriveFolder(folderPaths.clientFolderPath);
    if (clientFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for client folders.", missing: clientFolder.missing },
        { status: 503 },
      );
    }
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
    };

    if (!client.adobeAgreementId) {
      try {
        const agreement = await sendClientInductionAgreement({
          clientName,
          clientEmail: client.clientEmail,
          applicationType: client.applicationType,
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
        console.error("Adobe induction agreement send failed after folder creation", {
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
      oneDriveClientFolderPath: folderPaths.clientFolderPath,
      oneDriveFormsFolderPath: folderPaths.formsFolderPath,
      oneDriveBillingFolderPath: folderPaths.billingFolderPath,
      oneDriveClientFolderUrl: clientFolder.webUrl,
      legalAidApplicationStatus: client.legalAidApplicationStatus ?? "pending_signed_forms_and_msd",
      requiredDocumentOneUploaded: client.requiredDocumentOneUploaded ?? false,
      requiredDocumentTwoUploaded: client.requiredDocumentTwoUploaded ?? false,
      ...adobeUpdates,
      updatedAt: now,
    };

    try {
      await updateBillingClientInductionInSupabase(updatedClient);
    } catch (error) {
      console.error("Client folder metadata save failed after OneDrive/Adobe setup", {
        clientId: updatedClient.id,
        reason: error instanceof Error ? error.message : "Unknown Supabase save error",
      });
    }

    return NextResponse.json({
      status: "created",
      client: updatedClient,
      signing: {
        status: updatedClient.adobeAgreementStatus,
        agreementId: updatedClient.adobeAgreementId,
        message: updatedClient.adobeAgreementStatus === "sent"
          ? "Adobe induction agreement sent to the client."
          : updatedClient.adobeAgreementError || "Adobe induction agreement was not sent.",
      },
    });
  } catch (error) {
    console.error("Client OneDrive folder creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create client OneDrive folders." },
      { status: 500 },
    );
  }
}
