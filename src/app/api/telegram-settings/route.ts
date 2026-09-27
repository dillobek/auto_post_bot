import { NextResponse } from "next/server";
import { z } from "zod";
import { publicTelegramSettings, readTelegramSettings, writeTelegramSettings } from "@/lib/telegram-settings";

export const runtime = "nodejs";

const chatId = z.string().trim().regex(/^(?:-?\d+|@[A-Za-z][A-Za-z0-9_]{4,})$/, "Kanal IDsi yoki @username kiriting.").optional().or(z.literal(""));
const input = z.object({
  botToken: z.string().trim().regex(/^\d{6,}:[A-Za-z0-9_-]{20,}$/, "Telegram bot tokeni formati noto‘g‘ri.").optional(),
  channelId: chatId,
  groupId: chatId,
});

export async function GET() {
  try { return NextResponse.json(publicTelegramSettings(await readTelegramSettings())); }
  catch { return NextResponse.json({ error: "Server shifrlash kaliti sozlanmagan." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Sozlama noto‘g‘ri." }, { status: 400 });
  if (!parsed.data.botToken && !parsed.data.channelId && !parsed.data.groupId) return NextResponse.json({ error: "Kamida bitta sozlama kiriting." }, { status: 400 });
  try {
    const current = await readTelegramSettings();
    const next = {
      ...current,
      ...(parsed.data.botToken ? { botToken: parsed.data.botToken } : {}),
      ...(parsed.data.channelId !== undefined ? { channelId: parsed.data.channelId || undefined } : {}),
      ...(parsed.data.groupId !== undefined ? { groupId: parsed.data.groupId || undefined } : {}),
    };
    await writeTelegramSettings(next);
    return NextResponse.json(publicTelegramSettings({ ...next, updatedAt: new Date().toISOString() }));
  } catch { return NextResponse.json({ error: "Server shifrlash kaliti sozlanmagan yoki yaroqsiz." }, { status: 503 }); }
}
