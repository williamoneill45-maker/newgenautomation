import { NextResponse } from "next/server";

import type { BillingClientProfile } from "../../../lib/billing-storage";
import { deleteOneDrivePath } from "../../../lib/onedrive";
import {
  deleteBillingClientFromSupabase,
  listBillingClientsFromSupabase,
  saveBillingClientToSupabase,
} from "../../../lib/supabase-billing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listBillingClientsFromSupabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing client load failed", error);
    return NextResponse.json(
      { error: "Unable to load billing client metadata." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const client = (await request.json()) as BillingClientProfile;

    if (!client.id || !client.clientName?.trim()) {
      return NextResponse.json(
        { error: "Client id and name are required." },
        { status: 400 },
      );
    }

    const result = await saveBillingClientToSupabase(client);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing client save failed", error);
    return NextResponse.json(
      { error: "Unable to save billing client metadata." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      clientId?: string;
      oneDriveClientFolderPath?: string;
      deleteOneDrive?: boolean;
    };

    if (!body.clientId) {
      return NextResponse.json(
        { error: "Client id is required." },
        { status: 400 },
      );
    }

    const recordDelete = await deleteBillingClientFromSupabase(body.clientId);
    let oneDriveDelete:
      | Awaited<ReturnType<typeof deleteOneDrivePath>>
      | { status: "not_requested"; path: "" }
      | { status: "failed"; path: string; error: string } = { status: "not_requested", path: "" };

    if (body.deleteOneDrive) {
      if (!body.oneDriveClientFolderPath?.trim()) {
        return NextResponse.json(
          { error: "OneDrive folder path is required before OneDrive files can be deleted." },
          { status: 400 },
        );
      }

      try {
        oneDriveDelete = await deleteOneDrivePath(body.oneDriveClientFolderPath);
      } catch (error) {
        oneDriveDelete = {
          status: "failed",
          path: body.oneDriveClientFolderPath,
          error: error instanceof Error ? error.message : "OneDrive folder deletion failed.",
        };
      }
    }

    return NextResponse.json({
      status: "deleted",
      recordDelete,
      oneDriveDelete,
    });
  } catch (error) {
    console.error("Billing client delete failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete billing client metadata." },
      { status: 500 },
    );
  }
}
