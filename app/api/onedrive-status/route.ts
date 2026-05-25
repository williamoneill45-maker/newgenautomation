import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isConfigured(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

async function getGraphAccessToken(): Promise<string> {
  const existingToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  if (existingToken) return existingToken;

  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    return Promise.reject({ stage: "token", status: response.status, details: await response.text() });
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    return Promise.reject({ stage: "token", status: 200, details: "No access_token in response." });
  }

  return data.access_token;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldProbe = url.searchParams.get("probe") === "1";
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

  const result: Record<string, unknown> = {
    configured: missing.length === 0,
    checks,
    hasClientCredentials,
    missing,
  };

  if (shouldProbe && missing.length === 0) {
    try {
      const accessToken = await getGraphAccessToken();
      const driveId = process.env.MICROSOFT_GRAPH_DRIVE_ID?.trim() ?? "";
      const response = await fetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const text = await response.text();

      result.probe = {
        stage: "drive",
        ok: response.ok,
        status: response.status,
        details: response.ok ? "Drive lookup succeeded." : text,
      };
    } catch (error) {
      result.probe = {
        ok: false,
        ...(typeof error === "object" && error ? error : { stage: "unknown", details: String(error) }),
      };
    }
  }

  return NextResponse.json(result);
}
