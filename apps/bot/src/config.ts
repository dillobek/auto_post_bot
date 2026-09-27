import "dotenv/config";
import { z } from "zod";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : Number(value),
  z.number().int().positive().optional(),
);

const schema = z.object({
  BOT_MODE: z.enum(["mock", "polling"]).default("mock"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DOCTOR_TELEGRAM_ID: optionalNumber,
  TELEGRAM_CHANNEL_ID: optionalNumber,
  TELEGRAM_GROUP_ID: optionalNumber,
  ALLOWED_DOMAINS: z.string().default(""),
  ALLOWLIST_USER_IDS: z.string().default(""),
  URGENT_GROUP_TEMPLATE: z.string().default(""),
});

function commaList(value: string): string[] {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function numberList(value: string): number[] {
  return commaList(value).map(Number).filter(Number.isSafeInteger);
}

export type BotConfig = {
  mode: "mock" | "polling";
  token?: string;
  doctorTelegramId?: number;
  channelId?: number;
  groupId?: number;
  allowedDomains: Set<string>;
  allowlistUserIds: Set<number>;
  urgentGroupTemplate?: string;
};

export function loadConfig(env = process.env): BotConfig {
  const parsed = schema.parse(env);
  if (parsed.BOT_MODE === "polling" && !parsed.TELEGRAM_BOT_TOKEN) {
    throw new Error("BOT_MODE=polling uchun TELEGRAM_BOT_TOKEN kerak.");
  }
  return {
    mode: parsed.BOT_MODE,
    token: parsed.TELEGRAM_BOT_TOKEN,
    doctorTelegramId: parsed.DOCTOR_TELEGRAM_ID,
    channelId: parsed.TELEGRAM_CHANNEL_ID,
    groupId: parsed.TELEGRAM_GROUP_ID,
    allowedDomains: new Set(commaList(parsed.ALLOWED_DOMAINS)),
    allowlistUserIds: new Set(numberList(parsed.ALLOWLIST_USER_IDS)),
    urgentGroupTemplate: parsed.URGENT_GROUP_TEMPLATE || undefined,
  };
}
