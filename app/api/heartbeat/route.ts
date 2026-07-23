import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    missing: [supabaseUrl ? "" : "SUPABASE_URL", serviceKey ? "" : "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
  };
}

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function pingTable(supabaseUrl: string, serviceKey: string, table: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  return {
    table,
    ok: response.ok,
    status: response.status,
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { supabaseUrl, serviceKey, missing } = getSupabaseConfig();
  if (missing.length) {
    return NextResponse.json({ status: "not_configured", missing }, { status: 503 });
  }

  const checks = await Promise.all([
    pingTable(supabaseUrl, serviceKey, "matters"),
    pingTable(supabaseUrl, serviceKey, "billing_clients"),
    pingTable(supabaseUrl, serviceKey, "legal_aid_applications"),
  ]);

  const healthy = checks.every((check) => check.ok);
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 502 },
  );
}
