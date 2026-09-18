import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// Rutas accesibles sin sesión.
const PUBLIC_PATHS = ["/login", "/api/login"];

// Secciones restringidas a la sesión "Simón" (misma contraseña que el resto,
// pero marcada aparte en el login). Se bloquean aquí en vez de solo ocultar
// el enlace en el menú, para que tampoco se pueda entrar por URL directa.
const RUTAS_SOLO_SIMON = ["/cobros-especiales"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : { valid: false as const, role: "user" as const };

  if (!session.valid) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== "simon" && RUTAS_SOLO_SIMON.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
