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
    setClients(readBillingClients());
  }, []);

  const missingLegalAidClients = useMemo(() => {
    const now = Date.now();

    return clients.filter((client) => {
      if (client.legalAidNumber.trim()) return false;
      const createdAt = new Date(client.createdAt).getTime();
      return Number.isNaN(createdAt) || now - createdAt >= oneWeekMs;
    });
  }, [clients]);

  if (!missingLegalAidClients.length) {
    return null;
  }

  return (
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
  );
}
