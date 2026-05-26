import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
import {
  ensureOneDriveFolder,
  getAutomationClientFolderPath,
  uploadJsonToOneDrive,
} from "../../../../lib/onedrive";
import { updateBillingClientInductionInSupabase } from "../../../../lib/supabase-billing";

export const runtime = "nodejs";

type StartInductionRequest = {
  client: BillingClientProfile;
  clientEmail?: string;
  applicationType?: BillingClientProfile["applicationType"];
};

function safeFilePart(value: string): string {
  return value
    .replace(/[<>:"\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^A-Za-z0-9 ._-]+/g, "")
    .trim() || "client";
}

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

    if (!legalAidNumber) {
      return NextResponse.json(
        { error: "Legal Aid Number is required before induction automation can be requested." },
        { status: 400 },
      );
    }

    const baseFolderPath = getAutomationClientFolderPath({ clientName, legalAidNumber });
    const formsFolderPath = baseFolderPath;
    const billingFolderPath = baseFolderPath;
    const createdClientFolder = await ensureOneDriveFolder(baseFolderPath);

    if (createdClientFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for induction folders.", missing: createdClientFolder.missing },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
    const instructionsPayload = {
      type: "instructions",
      clientId: client.id,
      clientName,
      clientEmail,
      legalAidNumber,
      applicationType,
      fileCreatedTimestamp: now,
      clientFolderPath: baseFolderPath,
      documentsGenerated: false,
      adobeSign: {
        sendForSignature: true,
        recipientName: clientName,
        recipientEmail: clientEmail,
        packetName: "Induction / Letter of Engagement",
      },
      msdRequest: {
        autoPopulate: true,
        fileName: "05 MSD Request.docx",
        sendByAutomation: true,
      },
      supportingDocuments: {
        expectedFolderPath: baseFolderPath,
        includeGeneratedDocuments: true,
      },
    };
    const instructionsUpload = await uploadJsonToOneDrive(
      "instructions",
      instructionsPayload,
      baseFolderPath,
    );

    if (instructionsUpload.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for the induction instructions file.", missing: instructionsUpload.missing },
        { status: 503 },
      );
    }

    const requestPayload = {
      type: "client_induction",
      clientId: client.id,
      clientName,
      legalAidNumber,
      applicationType,
      clientEmail,
      clientFolderPath: baseFolderPath,
      formsFolderPath,
      billingFolderPath,
      instructionsPath: instructionsUpload.path,
      requestedAt: now,
    };
    const requestFileName = `${now.slice(0, 10)}-${Date.now()}-${safeFilePart(clientName)}-induction.json`;
    const triggerFolderPath = process.env.ONEDRIVE_INDUCTION_TRIGGER_FOLDER ?? "NewGenAutomation";
    const requestUpload = await uploadJsonToOneDrive(requestFileName, requestPayload, triggerFolderPath);

    if (requestUpload.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive automation request folder is not configured.", missing: requestUpload.missing },
        { status: 503 },
      );
    }

    const updatedClient: BillingClientProfile = {
      ...client,
      clientEmail,
      applicationType,
      oneDriveClientFolderPath: baseFolderPath,
      oneDriveFormsFolderPath: formsFolderPath,
      oneDriveBillingFolderPath: billingFolderPath,
      oneDriveClientFolderUrl: createdClientFolder.webUrl,
      inductionRequestPath: requestUpload.path,
      engagementStatus: "not_started",
      msdRequestStatus: "not_started",
      legalAidApplicationStatus: "pending_signed_forms_and_msd",
      inductionRequestedAt: now,
      updatedAt: now,
    };

    await updateBillingClientInductionInSupabase(updatedClient);

    return NextResponse.json({
      status: "started",
      client: updatedClient,
      request: {
        path: requestUpload.path,
        webUrl: requestUpload.webUrl,
      },
      instructions: {
        path: instructionsUpload.path,
        webUrl: instructionsUpload.webUrl,
      },
      signing: {
        status: "not_configured",
        message: "The instructions file was created for the Adobe/Power Automate signing flow. No direct Adobe API call was made by this app.",
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
