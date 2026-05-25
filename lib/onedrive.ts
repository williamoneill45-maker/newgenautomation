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
  automationRequestsPath: string;
  missing: string[];
};

function getRequiredEnv(): OneDriveEnv {
  const values = {
    accessToken: process.env.MICROSOFT_GRAPH_ACCESS_TOKEN ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    driveId: process.env.MICROSOFT_GRAPH_DRIVE_ID ?? process.env.ONEDRIVE_DRIVE_ID ?? "",
    rootPath: process.env.ONEDRIVE_BILLING_ROOT_PATH ?? "NewGenAutomation/Billing",
    automationRequestsPath: process.env.ONEDRIVE_AUTOMATION_REQUESTS_FOLDER ?? "NewGenAutomation/Automation Requests",
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

function cleanPath(value: string): string {
  return value.split("/").map((part) => part.trim()).filter(Boolean).join("/");
}

function encodePath(value: string): string {
  return cleanPath(value).split("/").map(encodeURIComponent).join("/");
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

async function graphRequest(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(url, {
    ...init,
    headers,
  });
}

async function getDriveItem(accessToken: string, driveId: string, path: string): Promise<{ exists: boolean; webUrl: string }> {
  const clean = cleanPath(path);
  const url = clean
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodePath(clean)}`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root`;
  const response = await graphRequest(accessToken, url);

  if (response.status === 404) return { exists: false, webUrl: "" };
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OneDrive folder lookup failed with status ${response.status}: ${details}`);
  }

  const data = (await response.json()) as { webUrl?: string };
  return { exists: true, webUrl: data.webUrl ?? "" };
}

async function createFolder(accessToken: string, driveId: string, parentPath: string, folderName: string): Promise<{ webUrl: string }> {
  const parent = cleanPath(parentPath);
  const url = parent
    ? `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root:/${encodePath(parent)}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/root/children`;
  const response = await graphRequest(accessToken, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (response.status === 409) {
    const existing = await getDriveItem(accessToken, driveId, cleanPath(`${parent}/${folderName}`));
    return { webUrl: existing.webUrl };
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OneDrive folder create failed with status ${response.status}: ${details}`);
  }

  const data = (await response.json()) as { webUrl?: string };
  return { webUrl: data.webUrl ?? "" };
}

export async function ensureOneDriveFolder(path: string): Promise<OneDriveUploadResult> {
  const env = getRequiredEnv();
  const clean = cleanPath(path);

  if (env.missing.length) {
    return {
      status: "not_configured",
      webUrl: "",
      path: clean,
      missing: env.missing,
    };
  }

  const accessToken = await getGraphAccessToken(env);
  const parts = clean.split("/").filter(Boolean);
  let currentPath = "";
  let webUrl = "";

  for (const part of parts) {
    const nextPath = cleanPath(`${currentPath}/${part}`);
    const existing = await getDriveItem(accessToken, env.driveId, nextPath);
    if (existing.exists) {
      webUrl = existing.webUrl;
    } else {
      const created = await createFolder(accessToken, env.driveId, currentPath, part);
      webUrl = created.webUrl;
    }
    currentPath = nextPath;
  }

  return {
    status: "uploaded",
    webUrl,
    path: clean,
  };
}

export async function uploadJsonToOneDrive(
  fileName: string,
  payload: unknown,
  folderPath = getRequiredEnv().automationRequestsPath,
): Promise<OneDriveUploadResult> {
  const env = getRequiredEnv();
  const cleanFolder = cleanPath(folderPath);
  const oneDrivePath = cleanPath(`${cleanFolder}/${fileName}`);

  if (env.missing.length) {
    return {
      status: "not_configured",
      webUrl: "",
      path: oneDrivePath,
      missing: env.missing,
    };
  }

  const folder = await ensureOneDriveFolder(cleanFolder);
  if (folder.status === "not_configured") return folder;

  const accessToken = await getGraphAccessToken(env);
  const uploadUrl =
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(env.driveId)}` +
    `/root:/${encodePath(oneDrivePath)}:/content`;
  const response = await graphRequest(accessToken, uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload, null, 2),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OneDrive JSON upload failed with status ${response.status}: ${details}`);
  }

  const data = (await response.json()) as { webUrl?: string };
  return {
    status: "uploaded",
    webUrl: data.webUrl ?? "",
    path: oneDrivePath,
  };
}
