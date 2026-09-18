import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null);
  const password = body?.get("password");

  if (typeof password !== "string" || !checkPassword(password)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, { status: 303 });
  }

  const esSimon = body?.get("esSimon") === "1";
  const token = await createSessionToken(esSimon ? "simon" : "user");
  const redirectTo = body?.get("from");
  const target = typeof redirectTo === "string" && redirectTo.startsWith("/") ? redirectTo : "/";

  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
