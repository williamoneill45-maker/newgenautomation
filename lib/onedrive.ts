export type OneDriveUploadResult =
  | {
      status: "uploaded";
      webUrl: string;
      path: string;
    }
  | {
      status: "not_configured";
      webUrl: "";
      path: string;
      missing: string[];
    };

type OneDriveEnv = {
  accessToken: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  driveId: string;
  rootPath: string;
  missing: string[];
};

function getRequiredEnv(): OneDriveEnv {
  const values = {
    accessToken: process.env.MICROSOFT_GRAPH_ACCESS_TOKEN ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    driveId: process.env.MICROSOFT_GRAPH_DRIVE_ID ?? "",
    rootPath: process.env.ONEDRIVE_BILLING_ROOT_PATH ?? "NewGenAutomation/Billing",
  };
  const canUseClientCredentials = Boolean(values.tenantId && values.clientId && values.clientSecret);
  const missing = [
    values.driveId ? "" : "MICROSOFT_GRAPH_DRIVE_ID",
    values.accessToken || canUseClientCredentials
      ? ""
      : "MICROSOFT_GRAPH_ACCESS_TOKEN or MICROSOFT_TENANT_ID/MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET",
  ].filter(Boolean);

  return { ...values, missing };
}

async function getGraphAccessToken(env: OneDriveEnv): Promise<string> {
  if (env.accessToken) return env.accessToken;

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(env.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Microsoft Graph token request failed with status ${response.status}: ${details}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Microsoft Graph token response did not include an access token.");
  }

  return data.access_token;
}

export async function uploadBillingDocumentToOneDrive(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<OneDriveUploadResult> {
  const env = getRequiredEnv();
  const oneDrivePath = `${env.rootPath.replace(/\/$/, "")}/${fileName}`;

  if (env.missing.length) {
    return {
      status: "not_configured",
      webUrl: "",
      path: oneDrivePath,
      missing: env.missing,
    };
  }

  const accessToken = await getGraphAccessToken(env);
  const uploadUrl =
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.driveId)}` +
    `/root:/${oneDrivePath.split("/").map(encodeURIComponent).join("/")}:/content`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    body: buffer,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OneDrive upload failed with status ${response.status}: ${details}`);
  }

  const data = (await response.json()) as { webUrl?: string };
  return {
    status: "uploaded",
    webUrl: data.webUrl ?? "",
    path: oneDrivePath,
  };
}
