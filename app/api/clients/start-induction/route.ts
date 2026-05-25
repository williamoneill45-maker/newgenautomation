import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
import {
  ensureOneDriveFolder,
  uploadJsonToOneDrive,
} from "../../../../lib/onedrive";
import { updateBillingClientInductionInSupabase } from "../../../../lib/supabase-billing";

export const runtime = "nodejs";

type StartInductionRequest = {
  client: BillingClientProfile;
  clientEmail?: string;
  applicationType?: BillingClientProfile["applicationType"];
};

function safePathPart(value: string): string {
  return value
    .replace(/[<>:"\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilePart(value: string): string {
  return safePathPart(value).replace(/[^A-Za-z0-9 ._-]+/g, "").trim() || "client";
}

function clientFolderName(clientName: string, legalAidNumber: string): string {
  const safeName = safePathPart(clientName) || "Unnamed Client";
  const safeLegalAid = safePathPart(legalAidNumber);
  return safeLegalAid ? `${safeName} - ${safeLegalAid}` : safeName;
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
        { error: "Client email is required before Adobe Sign induction can be requested." },
        { status: 400 },
      );
    }

    if (!applicationType) {
      return NextResponse.json(
        { error: "Choose Parenting, Protection, or Both before starting induction." },
        { status: 400 },
      );
    }

    const rootPath = (process.env.ONEDRIVE_CLIENTS_ROOT_PATH ?? "NewGenAutomation/Clients").replace(/\/$/, "");
    const baseFolderPath = `${rootPath}/${clientFolderName(clientName, legalAidNumber)}`;
    const formsFolderPath = `${baseFolderPath}/Forms and Induction`;
    const billingFolderPath = `${baseFolderPath}/Billing`;
    const createdClientFolder = await ensureOneDriveFolder(baseFolderPath);

    if (createdClientFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for induction folders.", missing: createdClientFolder.missing },
        { status: 503 },
      );
    }

    const formsFolder = await ensureOneDriveFolder(formsFolderPath);
    const billingFolder = await ensureOneDriveFolder(billingFolderPath);
    if (formsFolder.status === "not_configured" || billingFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for induction subfolders." },
        { status: 503 },
      );
    }

    const now = new Date().toISOString();
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
      requestedAt: now,
    };
    const requestFileName = `${now.slice(0, 10)}-${Date.now()}-${safeFilePart(clientName)}-induction.json`;
    const requestUpload = await uploadJsonToOneDrive(requestFileName, requestPayload);

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
      engagementStatus: "sent",
      msdRequestStatus: "sent",
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
    });
  } catch (error) {
    console.error("Client induction start failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start client induction." },
      { status: 500 },
    );
  }
}
