import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "cubi_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 días

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

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  return Boolean(expected) && candidate === expected;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS;
