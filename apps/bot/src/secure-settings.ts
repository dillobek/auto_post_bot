import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

type EncryptedPayload = { iv: string; tag: string; ciphertext: string };
export type StoredTelegramSettings = { botToken?: string; channelId?: string; groupId?: string };

function key(): Buffer | undefined {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw) return undefined;
  const value = Buffer.from(raw, "base64");
  return value.length === 32 ? value : undefined;
}

export function loadStoredSettings(): StoredTelegramSettings {
  const encryptionKey = key();
  if (!encryptionKey) return {};
  const file = process.env.SHIFOKOR_SETTINGS_FILE ?? path.resolve(process.cwd(), "../../data/telegram-settings.enc");
  try {
    const payload = JSON.parse(readFileSync(file, "utf8")) as EncryptedPayload;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8")) as StoredTelegramSettings;
  } catch { return {}; }
}
