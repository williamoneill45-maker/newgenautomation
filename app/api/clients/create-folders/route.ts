import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../../lib/billing-storage";
import {
  ensureOneDriveFolder,
  getAutomationClientFolderPath,
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

    const clientFolderPath = getAutomationClientFolderPath({ clientName, legalAidNumber });

    const clientFolder = await ensureOneDriveFolder(clientFolderPath);
    if (clientFolder.status === "not_configured") {
      return NextResponse.json(
        { error: "OneDrive is not configured for client folders.", missing: clientFolder.missing },
        { status: 503 },
      );
    }

    const updatedClient: BillingClientProfile = {
      ...client,
      oneDriveClientFolderPath: clientFolderPath,
      oneDriveFormsFolderPath: clientFolderPath,
      oneDriveBillingFolderPath: clientFolderPath,
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
