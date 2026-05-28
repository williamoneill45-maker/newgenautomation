import { NextResponse } from "next/server";
import { authCookieName } from "../../../lib/auth-gate";

export async function POST() {
  const response = NextResponse.json({ status: "signed_out" });
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

