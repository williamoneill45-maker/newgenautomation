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

function getRequiredEnv() {
  const values = {
    accessToken: process.env.MICROSOFT_GRAPH_ACCESS_TOKEN ?? "",
    driveId: process.env.MICROSOFT_GRAPH_DRIVE_ID ?? "",
    rootPath: process.env.ONEDRIVE_BILLING_ROOT_PATH ?? "NewGenAutomation/Billing",
  };
  const missing = [
    values.accessToken ? "" : "MICROSOFT_GRAPH_ACCESS_TOKEN",
    values.driveId ? "" : "MICROSOFT_GRAPH_DRIVE_ID",
  ].filter(Boolean);

  return { ...values, missing };
}

export async function uploadBillingDocumentToOneDrive(
  fileName: string,
  buffer: ArrayBuffer,
): Promise<OneDriveUploadResult> {
  const { accessToken, driveId, rootPath, missing } = getRequiredEnv();
  const oneDrivePath = `${rootPath.replace(/\/$/, "")}/${fileName}`;

  if (missing.length) {
    return {
      status: "not_configured",
      webUrl: "",
      path: oneDrivePath,
      missing,
    };
  }

  const uploadUrl =
    `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}` +
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
    throw new Error(`OneDrive upload failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { webUrl?: string };
  return {
    status: "uploaded",
    webUrl: data.webUrl ?? "",
    path: oneDrivePath,
  };
}
