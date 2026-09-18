import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "cubi_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 días

export type SessionRole = "simon" | "user";

function getSecret() {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error("Falta la variable de entorno APP_PASSWORD");
  }
  // Derivamos la clave de firma de la propia contraseña: no hace falta un
  // segundo secreto que gestionar, y cambiar la contraseña invalida las
  // sesiones existentes automáticamente.
  return new TextEncoder().encode(`cubi-session-key:${secret}`);
}

export async function createSessionToken(role: SessionRole): Promise<string> {
  return new SignJWT({ ok: true, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export interface SessionInfo {
  valid: boolean;
  role: SessionRole;
}

export async function verifySessionToken(token: string): Promise<SessionInfo> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role: SessionRole = payload.role === "simon" ? "simon" : "user";
    return { valid: true, role };
  } catch {
    return { valid: false, role: "user" };
  }
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  return Boolean(expected) && candidate === expected;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;

// Para usar en Server Components (p.ej. para ocultar del menú lo que no
// corresponda a la sesión actual). El middleware ya bloquea el acceso real
// por URL; esto es solo para no mostrar el enlace.
export async function getSessionRole(): Promise<SessionRole | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  return session.valid ? session.role : null;
}
