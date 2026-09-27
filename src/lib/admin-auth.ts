import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { readTelegramSettings } from "./telegram-settings";

const sessionCookie = "shifokor_admin_session";
const sessionTtlSeconds = 60 * 60 * 12;

type AdminCredentials = { username: string; passwordHash?: string; bootstrapPassword?: string };

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function secret(): string {
  const value = process.env.CONFIG_ENCRYPTION_KEY;
  if (!value) throw new Error("CONFIG_ENCRYPTION_KEY sozlanmagan.");
  return value;
}

export function passwordHash(password: string, salt = randomBytes(16).toString("base64")): string {
  const derived = scryptSync(password, salt, 64).toString("base64");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("base64");
  return secureEqual(actual, expected);
}

export async function adminCredentials(): Promise<AdminCredentials | null> {
  const settings = await readTelegramSettings();
  if (settings.adminUsername && settings.adminPasswordHash) return { username: settings.adminUsername, passwordHash: settings.adminPasswordHash };
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, bootstrapPassword: password } : null;
}

export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const credentials = await adminCredentials();
  if (!credentials || credentials.username !== username) return false;
  return credentials.passwordHash ? verifyPassword(password, credentials.passwordHash) : secureEqual(password, credentials.bootstrapPassword!);
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(username: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionTtlSeconds;
  const payload = `${username}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

async function sessionUsername(): Promise<string | null> {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;
  const [username, expiresAt, signature] = value.split(".");
  if (!username || !expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;
  const expected = sign(`${username}.${expiresAt}`);
  if (!secureEqual(signature, expected)) return null;
  return username;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const [username, credentials] = await Promise.all([sessionUsername(), adminCredentials()]);
    return Boolean(username && credentials && username === credentials.username);
  } catch {
    return false;
  }
}

export const adminSession = { cookie: sessionCookie, maxAge: sessionTtlSeconds };
