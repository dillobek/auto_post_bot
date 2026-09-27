import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type TelegramSettings = {
  botToken?: string;
  channelId?: string;
  groupId?: string;
  updatedAt?: string;
};

type EncryptedPayload = { iv: string; tag: string; ciphertext: string };

const settingsPath = path.join(process.cwd(), "data", "telegram-settings.enc");

function encryptionKey(): Buffer {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONFIG_ENCRYPTION_KEY sozlanmagan.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CONFIG_ENCRYPTION_KEY 32 baytli base64 qiymat bo‘lishi kerak.");
  return key;
}

function encrypt(settings: TelegramSettings): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(settings), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

function decrypt(payload: EncryptedPayload): TelegramSettings {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8")) as TelegramSettings;
}

export async function readTelegramSettings(): Promise<TelegramSettings> {
  try {
    return decrypt(JSON.parse(await readFile(settingsPath, "utf8")) as EncryptedPayload);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function writeTelegramSettings(settings: TelegramSettings): Promise<void> {
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(encrypt({ ...settings, updatedAt: new Date().toISOString() })), { encoding: "utf8", mode: 0o600 });
}

export function publicTelegramSettings(settings: TelegramSettings) {
  return { hasBotToken: Boolean(settings.botToken), channelId: settings.channelId ?? "", groupId: settings.groupId ?? "", updatedAt: settings.updatedAt ?? null };
}
