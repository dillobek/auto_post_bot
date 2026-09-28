import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated, passwordHash } from "@/lib/admin-auth";
import { publicTelegramSettings, readTelegramSettings, writeTelegramSettings } from "@/lib/telegram-settings";

export const runtime = "nodejs";

const chatId = z.string().trim().regex(/^(?:-?\d+|@[A-Za-z][A-Za-z0-9_]{4,})$/, "Kanal IDsi yoki @username kiriting.").optional().or(z.literal(""));
const sourceUrl = z.string().trim().url("Manba uchun to‘liq https:// havola kiriting.").refine((value) => value.startsWith("https://"), "Manba havolasi https:// bilan boshlansin.");
const scheduleItem = z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Post vaqti HH:MM formatida bo‘lsin."), enabled: z.boolean() });
const scheduleList = z.array(scheduleItem).max(12).superRefine((items, context) => { if (new Set(items.map((item) => item.time)).size !== items.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Bir oqimda bir vaqtni ikki marta kiritmang." }); });
const optionalUrl = z.string().trim().url("Website uchun to‘liq https:// havola kiriting.").refine((value) => value.startsWith("https://"), "Website havolasi https:// bilan boshlansin.").optional().or(z.literal(""));
const optionalPhone = z.string().trim().regex(/^[+0-9() -]{7,30}$/, "Telefon raqami formatini tekshiring.").optional().or(z.literal(""));
const optionalHandle = z.string().trim().regex(/^@?[A-Za-z0-9._]{2,64}$/, "Username formatini tekshiring.").optional().or(z.literal(""));
const input = z.object({
  botToken: z.string().trim().regex(/^\d{6,}:[A-Za-z0-9_-]{20,}$/, "Telegram bot tokeni formati noto‘g‘ri.").optional(),
  channelId: chatId,
  groupId: chatId,
  openAiApiKey: z.string().trim().min(20, "OpenAI API kaliti formati noto‘g‘ri.").optional(),
  openAiModel: z.enum(["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"]).optional(),
  contentTopics: z.array(z.string().trim().min(2, "Mavzu kamida 2 belgidan iborat bo‘lsin.").max(120)).max(20).optional(),
  contentCta: z.string().trim().max(500, "CTA 500 belgidan oshmasin.").optional(),
  ctaAdminUsername: optionalHandle,
  websiteUrl: optionalUrl,
  phoneNumber: optionalPhone,
  additionalPhoneNumber: optionalPhone,
  instagramHandle: optionalHandle,
  sourceUrls: z.array(sourceUrl).max(20).optional(),
  postSchedules: z.object({ post: scheduleList.optional(), poll: scheduleList.optional(), info: scheduleList.optional() }).optional(),
  adminUsername: z.string().trim().min(3, "Username kamida 3 belgidan iborat bo‘lsin.").max(64).regex(/^[A-Za-z0-9._-]+$/, "Username faqat harf, raqam, nuqta, tire va pastki chiziqdan iborat bo‘lsin.").optional(),
  newPassword: z.string().min(12, "Yangi password kamida 12 belgidan iborat bo‘lsin.").max(128).optional(),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });
  try { return NextResponse.json(publicTelegramSettings(await readTelegramSettings())); }
  catch { return NextResponse.json({ error: "Server shifrlash kaliti sozlanmagan." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "Kirish talab qilinadi." }, { status: 401 });
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Sozlama noto‘g‘ri." }, { status: 400 });
  if (!parsed.data.botToken && parsed.data.channelId === undefined && parsed.data.groupId === undefined && !parsed.data.openAiApiKey && !parsed.data.openAiModel && parsed.data.contentTopics === undefined && parsed.data.contentCta === undefined && parsed.data.ctaAdminUsername === undefined && parsed.data.websiteUrl === undefined && parsed.data.phoneNumber === undefined && parsed.data.additionalPhoneNumber === undefined && parsed.data.instagramHandle === undefined && parsed.data.sourceUrls === undefined && parsed.data.postSchedules === undefined && !parsed.data.adminUsername && !parsed.data.newPassword) return NextResponse.json({ error: "Kamida bitta sozlama kiriting." }, { status: 400 });
  try {
    const current = await readTelegramSettings();
    const next = {
      ...current,
      ...(parsed.data.botToken ? { botToken: parsed.data.botToken } : {}),
      ...(parsed.data.channelId !== undefined ? { channelId: parsed.data.channelId || undefined } : {}),
      ...(parsed.data.groupId !== undefined ? { groupId: parsed.data.groupId || undefined } : {}),
      ...(parsed.data.openAiApiKey ? { openAiApiKey: parsed.data.openAiApiKey } : {}),
      ...(parsed.data.openAiModel ? { openAiModel: parsed.data.openAiModel } : {}),
      ...(parsed.data.contentTopics !== undefined ? { contentTopics: parsed.data.contentTopics } : {}),
      ...(parsed.data.contentCta !== undefined ? { contentCta: parsed.data.contentCta || undefined } : {}),
      ...(parsed.data.ctaAdminUsername !== undefined ? { ctaAdminUsername: parsed.data.ctaAdminUsername || undefined } : {}),
      ...(parsed.data.websiteUrl !== undefined ? { websiteUrl: parsed.data.websiteUrl || undefined } : {}),
      ...(parsed.data.phoneNumber !== undefined ? { phoneNumber: parsed.data.phoneNumber || undefined } : {}),
      ...(parsed.data.additionalPhoneNumber !== undefined ? { additionalPhoneNumber: parsed.data.additionalPhoneNumber || undefined } : {}),
      ...(parsed.data.instagramHandle !== undefined ? { instagramHandle: parsed.data.instagramHandle || undefined } : {}),
      ...(parsed.data.sourceUrls !== undefined ? { sourceUrls: parsed.data.sourceUrls } : {}),
      ...(parsed.data.postSchedules !== undefined ? { postSchedules: parsed.data.postSchedules } : {}),
      ...(parsed.data.adminUsername ? { adminUsername: parsed.data.adminUsername } : {}),
      ...(parsed.data.newPassword ? { adminPasswordHash: passwordHash(parsed.data.newPassword) } : {}),
    };
    await writeTelegramSettings(next);
    return NextResponse.json(publicTelegramSettings({ ...next, updatedAt: new Date().toISOString() }));
  } catch { return NextResponse.json({ error: "Server shifrlash kaliti sozlanmagan yoki yaroqsiz." }, { status: 503 }); }
}
