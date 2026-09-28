import { config as loadEnvironment } from "dotenv";
import path from "node:path";
import { z } from "zod";
import { loadStoredSettings, StoredPostSchedule, StoredPostSchedules } from "./secure-settings.js";

loadEnvironment({ path: path.resolve(process.cwd(), "../../.env") });
loadEnvironment();

const schema = z.object({
  BOT_MODE: z.enum(["mock", "polling"]).default("mock"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DOCTOR_TELEGRAM_ID: z.preprocess((value) => value === "" || value === undefined ? undefined : Number(value), z.number().int().positive().optional()),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_GROUP_ID: z.string().optional(),
  ALLOWED_DOMAINS: z.string().default(""),
  ALLOWLIST_USER_IDS: z.string().default(""),
  URGENT_GROUP_TEMPLATE: z.string().default(""),
});

function commaList(value: string): string[] { return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean); }
function numberList(value: string): number[] { return commaList(value).map(Number).filter(Number.isSafeInteger); }
function chatId(value?: string): number | string | undefined {
  if (!value) return undefined;
  if (/^-?\d+$/.test(value)) return Number(value);
  return /^@[A-Za-z][A-Za-z0-9_]{4,}$/.test(value) ? value : undefined;
}

export type BotConfig = {
  mode: "mock" | "polling";
  token?: string;
  doctorTelegramId?: number;
  channelId?: number | string;
  groupId?: number | string;
  allowedDomains: Set<string>;
  allowlistUserIds: Set<number>;
  urgentGroupTemplate?: string;
  openAiApiKey?: string;
  openAiModel: string;
  contentTopics: string[];
  channelContext?: string;
  contentCta?: string;
  ctaAdminUsername?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  additionalPhoneNumber?: string;
  instagramHandle?: string;
  sourceUrls: string[];
  postSchedules: Required<StoredPostSchedules>;
};

export function loadConfig(env = process.env): BotConfig {
  const parsed = schema.parse(env);
  const stored = loadStoredSettings();
  const token = parsed.TELEGRAM_BOT_TOKEN ?? stored.botToken;
  const channelId = parsed.TELEGRAM_CHANNEL_ID ?? stored.channelId;
  const groupId = parsed.TELEGRAM_GROUP_ID ?? stored.groupId;
  const validSchedule = (items: StoredPostSchedule[] | undefined) => (items ?? []).filter((item) => /^\d{2}:\d{2}$/.test(item.time) && typeof item.enabled === "boolean");
  return { mode: parsed.BOT_MODE, token, doctorTelegramId: parsed.DOCTOR_TELEGRAM_ID, channelId: chatId(channelId), groupId: chatId(groupId), allowedDomains: new Set(commaList(parsed.ALLOWED_DOMAINS)), allowlistUserIds: new Set(numberList(parsed.ALLOWLIST_USER_IDS)), urgentGroupTemplate: parsed.URGENT_GROUP_TEMPLATE || undefined, openAiApiKey: stored.openAiApiKey, openAiModel: stored.openAiModel ?? "gpt-4.1-mini", contentTopics: stored.contentTopics ?? [], channelContext: stored.channelContext, contentCta: stored.contentCta, ctaAdminUsername: stored.ctaAdminUsername, websiteUrl: stored.websiteUrl, phoneNumber: stored.phoneNumber, additionalPhoneNumber: stored.additionalPhoneNumber, instagramHandle: stored.instagramHandle, sourceUrls: stored.sourceUrls ?? [], postSchedules: { post: validSchedule(stored.postSchedules?.post ?? stored.postSchedule), poll: validSchedule(stored.postSchedules?.poll), info: validSchedule(stored.postSchedules?.info) } };
}
