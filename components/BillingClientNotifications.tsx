"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  billingClientsStorageKey,
  type BillingClientProfile,
} from "../lib/billing-storage";

const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

function readBillingClients(): BillingClientProfile[] {
  try {
    const raw = window.localStorage.getItem(billingClientsStorageKey);
    return raw ? (JSON.parse(raw) as BillingClientProfile[]) : [];
  } catch {
    window.localStorage.removeItem(billingClientsStorageKey);
    return [];
  }
}

export function BillingClientNotifications() {
  const [clients, setClients] = useState<BillingClientProfile[]>([]);

  useEffect(() => {
    const localClients = readBillingClients();
    setClients(localClients);

    fetch("/api/billing-clients")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { status?: string; clients?: BillingClientProfile[] } | null) => {
        if (payload?.status === "loaded" && Array.isArray(payload.clients)) {
          const merged = new Map<string, BillingClientProfile>();
          for (const client of localClients) merged.set(client.id, client);
          for (const client of payload.clients) merged.set(client.id, { ...merged.get(client.id), ...client });
          setClients([...merged.values()]);
        }
      })
      .catch(() => undefined);
  }, []);

  const missingLegalAidClients = useMemo(() => {
    const now = Date.now();

    return clients.filter((client) => {
      if (client.legalAidNumber.trim()) return false;
      const createdAt = new Date(client.createdAt).getTime();
      return Number.isNaN(createdAt) || now - createdAt >= oneWeekMs;
    });
  }, [clients]);

  const pendingInductionClients = useMemo(() =>
    clients.filter((client) =>
      client.legalAidApplicationStatus === "pending_signed_forms_and_msd" ||
      client.engagementStatus === "sent" ||
      client.msdRequestStatus === "sent",
    ),
  [clients]);

  if (!missingLegalAidClients.length && !pendingInductionClients.length) {
    return null;
  }

  return (
    <>
      {pendingInductionClients.length ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-sky-950">Induction follow-up</h3>
            <span className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-900">
              Waiting
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-sky-900">
            {pendingInductionClients.slice(0, 3).map((client) => client.clientName).join(", ")}
            {pendingInductionClients.length > 3 ? ` and ${pendingInductionClients.length - 3} more` : ""} are waiting on signed induction forms and/or MSD responses.
          </p>
          <Link href="/clients" className="mt-2 inline-flex text-sm font-semibold text-sky-950 hover:text-sky-800">
            Review clients
          </Link>
        </div>
      ) : null}

      {missingLegalAidClients.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-amber-950">Billing client details</h3>
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              Missing legal aid
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-amber-900">
            {missingLegalAidClients.slice(0, 3).map((client) => client.clientName).join(", ")}
            {missingLegalAidClients.length > 3 ? ` and ${missingLegalAidClients.length - 3} more` : ""} need legal aid numbers before billing can be filed cleanly.
          </p>
          <Link href="/clients" className="mt-2 inline-flex text-sm font-semibold text-amber-950 hover:text-amber-800">
            Review clients
          </Link>
        </div>
      ) : null}
    </>
  );
}
