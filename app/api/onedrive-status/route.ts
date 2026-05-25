import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isConfigured(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export async function GET() {
  const checks = {
    MICROSOFT_GRAPH_DRIVE_ID: isConfigured(process.env.MICROSOFT_GRAPH_DRIVE_ID),
    MICROSOFT_TENANT_ID: isConfigured(process.env.MICROSOFT_TENANT_ID),
    MICROSOFT_CLIENT_ID: isConfigured(process.env.MICROSOFT_CLIENT_ID),
    MICROSOFT_CLIENT_SECRET: isConfigured(process.env.MICROSOFT_CLIENT_SECRET),
    MICROSOFT_GRAPH_ACCESS_TOKEN: isConfigured(process.env.MICROSOFT_GRAPH_ACCESS_TOKEN),
    ONEDRIVE_BILLING_ROOT_PATH: isConfigured(process.env.ONEDRIVE_BILLING_ROOT_PATH),
  };
  const hasClientCredentials = checks.MICROSOFT_TENANT_ID && checks.MICROSOFT_CLIENT_ID && checks.MICROSOFT_CLIENT_SECRET;
  const missing = [
    checks.MICROSOFT_GRAPH_DRIVE_ID ? "" : "MICROSOFT_GRAPH_DRIVE_ID",
    checks.MICROSOFT_GRAPH_ACCESS_TOKEN || hasClientCredentials
      ? ""
      : "MICROSOFT_GRAPH_ACCESS_TOKEN or MICROSOFT_TENANT_ID/MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET",
  ].filter(Boolean);

  return NextResponse.json({
    configured: missing.length === 0,
    checks,
    hasClientCredentials,
    missing,
  });
}
