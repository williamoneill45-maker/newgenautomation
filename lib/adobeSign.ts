import type { BillingClientProfile } from "./billing-storage";

type AdobeAgreementResponse = {
  id?: string;
};

export type AdobeSendResult = {
  agreementId: string;
  agreementName: string;
  status: "sent";
  sentAt: string;
};

type AdobeTemplateKind = "protection" | "parenting" | "both" | "default";

function getTemplateKind(input?: {
  proceedingsType?: string;
  applicationType?: BillingClientProfile["applicationType"];
}): AdobeTemplateKind {
  const value = `${input?.proceedingsType ?? ""} ${input?.applicationType ?? ""}`.toLowerCase();

  if (value.includes("both") || value.includes("protection_and_parenting")) return "both";
  if (value.includes("parenting") || value.includes("care_of_children")) return "parenting";
  if (value.includes("protection") || value.includes("family_violence")) return "protection";

  return "default";
}

function getLibraryDocumentId(kind: AdobeTemplateKind) {
  const fallback = process.env.ADOBE_SIGN_LIBRARY_DOCUMENT_ID ?? "";
  const byKind: Record<AdobeTemplateKind, { envName: string; value: string }> = {
    protection: {
      envName: "ADOBE_SIGN_PROTECTION_ORDER_LIBRARY_DOCUMENT_ID",
      value: process.env.ADOBE_SIGN_PROTECTION_ORDER_LIBRARY_DOCUMENT_ID ?? fallback,
    },
    parenting: {
      envName: "ADOBE_SIGN_PARENTING_ORDER_LIBRARY_DOCUMENT_ID",
      value: process.env.ADOBE_SIGN_PARENTING_ORDER_LIBRARY_DOCUMENT_ID ?? fallback,
    },
    both: {
      envName: "ADOBE_SIGN_BOTH_LIBRARY_DOCUMENT_ID",
      value: process.env.ADOBE_SIGN_BOTH_LIBRARY_DOCUMENT_ID ?? fallback,
    },
    default: {
      envName: "ADOBE_SIGN_LIBRARY_DOCUMENT_ID",
      value: fallback,
    },
  };

  return byKind[kind];
}

function getAdobeConfig(templateKind: AdobeTemplateKind = "default") {
  const accessToken = process.env.ADOBE_SIGN_ACCESS_TOKEN ?? "";
  const apiBaseUrl =
    process.env.ADOBE_SIGN_API_BASE_URL?.replace(/\/$/, "") ??
    "https://api.na1.adobesign.com/api/rest/v6";
  const selectedTemplate = getLibraryDocumentId(templateKind);
  const libraryDocumentId = selectedTemplate.value;
  const groupId = process.env.ADOBE_SIGN_GROUP_ID ?? "";

  const missing = [
    accessToken ? "" : "ADOBE_SIGN_ACCESS_TOKEN",
    libraryDocumentId ? "" : selectedTemplate.envName,
  ].filter(Boolean);

  return { accessToken, apiBaseUrl, libraryDocumentId, groupId, missing, templateKind };
}

export function isAdobeSignConfigured(): boolean {
  return getAdobeConfig().missing.length === 0;
}

export async function sendClientInductionAgreement(
  client: Pick<BillingClientProfile, "clientName" | "clientEmail" | "applicationType"> & {
    proceedingsType?: string;
  },
): Promise<AdobeSendResult> {
  const clientName = client.clientName.trim();
  const clientEmail = client.clientEmail?.trim() ?? "";
  const templateKind = getTemplateKind({
    proceedingsType: client.proceedingsType,
    applicationType: client.applicationType,
  });
  const config = getAdobeConfig(templateKind);

  if (!clientName) {
    throw new Error("Client name is required before sending the Adobe induction agreement.");
  }

  if (!clientEmail) {
    throw new Error("Client email is required before sending the Adobe induction agreement.");
  }

  if (config.missing.length) {
    throw new Error(`Adobe Sign is not configured. Missing: ${config.missing.join(", ")}.`);
  }

  const agreementName = `Information to Client - ${clientName}`;
  const response = await fetch(`${config.apiBaseUrl}/agreements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...(config.groupId ? { "x-api-user": `groupId:${config.groupId}` } : {}),
    },
    body: JSON.stringify({
      fileInfos: [
        {
          libraryDocumentId: config.libraryDocumentId,
        },
      ],
      name: agreementName,
      participantSetsInfo: [
        {
          memberInfos: [
            {
              email: clientEmail,
            },
          ],
          order: 1,
          role: "SIGNER",
        },
      ],
      signatureType: "ESIGN",
      state: "IN_PROCESS",
      message: "Please review and complete this document.",
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Adobe Sign agreement send failed", {
      status: response.status,
      statusText: response.statusText,
      clientName,
      templateKind: config.templateKind,
      hasLibraryDocumentId: Boolean(config.libraryDocumentId),
      details: details.slice(0, 500),
    });
    throw new Error(`Adobe Sign agreement send failed with status ${response.status}.`);
  }

  const payload = (await response.json().catch(() => ({}))) as AdobeAgreementResponse;
  if (!payload.id) {
    console.error("Adobe Sign agreement response did not include an id", {
      clientName,
      templateKind: config.templateKind,
      hasLibraryDocumentId: Boolean(config.libraryDocumentId),
    });
    throw new Error("Adobe Sign did not return an agreement id.");
  }

  return {
    agreementId: payload.id,
    agreementName,
    status: "sent",
    sentAt: new Date().toISOString(),
  };
}

export async function getAgreementStatus(agreementId: string): Promise<string> {
  const config = getAdobeConfig();
  if (!agreementId.trim()) {
    throw new Error("Adobe agreement id is required before checking agreement status.");
  }
  if (config.missing.includes("ADOBE_SIGN_ACCESS_TOKEN")) {
    throw new Error("Adobe Sign is not configured. Missing: ADOBE_SIGN_ACCESS_TOKEN.");
  }

  const response = await fetch(`${config.apiBaseUrl}/agreements/${encodeURIComponent(agreementId)}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(config.groupId ? { "x-api-user": `groupId:${config.groupId}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Adobe Sign agreement status lookup failed with status ${response.status}.`);
  }

  const payload = (await response.json().catch(() => ({}))) as { status?: string };
  return payload.status ?? "UNKNOWN";
}
