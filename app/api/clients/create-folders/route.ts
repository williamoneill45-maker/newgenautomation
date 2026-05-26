import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
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

    if (!legalAidNumber) {
      return NextResponse.json(
        { error: "Legal Aid Number is required before the Power Automate client folder can be created." },
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

    const updatedClient: BillingClientProfile = {
      ...client,
      oneDriveClientFolderPath: folderPaths.clientFolderPath,
      oneDriveFormsFolderPath: folderPaths.formsFolderPath,
      oneDriveBillingFolderPath: folderPaths.billingFolderPath,
      oneDriveClientFolderUrl: clientFolder.webUrl,
      updatedAt: new Date().toISOString(),
    };

    await updateBillingClientInductionInSupabase(updatedClient);

    return NextResponse.json({
      status: "created",
      client: updatedClient,
    });
  } catch (error) {
    console.error("Client OneDrive folder creation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create client OneDrive folders." },
      { status: 500 },
    );
  }
}
