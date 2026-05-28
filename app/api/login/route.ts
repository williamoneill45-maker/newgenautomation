import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { authCookieName, authPasswordHash, authSessionValue, authUsername } from "../../../lib/auth-gate";

export const runtime = "nodejs";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";
  const validUsername = safeEqual(username, authUsername);
  const validPassword = safeEqual(sha256(password), authPasswordHash);

  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ status: "authenticated" });
  response.cookies.set(authCookieName, authSessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

