"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { LegalAidRecord } from "../lib/legal-aid";

function missingItems(application: LegalAidRecord) {
  return [
    application.hasIncomeProof ? "" : "income proof/page 2",
    application.hasSignedPage ? "" : "signed client page 5",
  ].filter(Boolean);
}

export function LegalAidNotifications() {
  const [applications, setApplications] = useState<LegalAidRecord[]>([]);
  const [source, setSource] = useState("");

  useEffect(() => {
    fetch("/api/legal-aid-applications?pending=true", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.status === "loaded") {
          setApplications(payload.data);
          setSource("Supabase");
          return;
        }

        if (payload.status === "not_configured") {
          setSource(`Supabase pending: ${payload.missing.join(", ")}`);
        }
      })
      .catch(() => setSource("Legal Aid notifications unavailable"));
  }, []);

  if (!applications.length && !source) return null;

  return (
    <div className="mt-3 space-y-3">
      {applications.map((application) => {
        const missing = missingItems(application);
        return (
          <Link
            key={application.id}
            href="/legal-aid"
            className="block rounded-md border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-300 hover:bg-amber-100"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-amber-950">
                Legal Aid upload pending
              </h3>
              <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                {application.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-5 text-amber-900">
              {application.clientName || application.review.clientName}: missing {missing.join(" and ")}.
            </p>
          </Link>
        );
      })}
      {source && !applications.length ? (
        <div className="rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-slate-950">Legal Aid uploads</h3>
          <p className="mt-2 text-sm leading-5 text-slate-600">{source}</p>
        </div>
      ) : null}
    </div>
  );
}
