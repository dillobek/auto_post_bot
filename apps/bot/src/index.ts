import { Bot, Context } from "grammy";
import { loadConfig } from "./config.js";
import { classifyTriage, decideModeration, isMedicalQuestion, normalizedText, redactPersonalData } from "./policy.js";
import { startPostScheduler } from "./post-scheduler.js";
import { createRuntimeState, incrementMessage, rememberAlert } from "./runtime-store.js";

let config = loadConfig();
const runtime = createRuntimeState();
let pollingStarted = false;

function messageText(ctx: Context): string | undefined {
  const message = ctx.message;
  return message?.text ?? message?.caption;
}

async function isProtected(ctx: Context, userId: number): Promise<boolean> {
  if (config.allowlistUserIds.has(userId)) return true;
  const member = await ctx.api.getChatMember(ctx.chat!.id, userId);
  return member.status === "creator" || member.status === "administrator";
}

async function alertDoctor(ctx: Context, level: "NORMAL" | "URGENT", body: string): Promise<void> {
  if (!config.doctorTelegramId || !ctx.message || !ctx.chat) return;
  const link = ctx.chat.username ? `https://t.me/${ctx.chat.username}/${ctx.message.message_id}` : `Guruh xabari #${ctx.message.message_id}`;
  const prefix = level === "URGENT" ? "🔴 SHOSHILINCH SIGNAL" : "🟡 Yangi tibbiy savol";
  await ctx.api.sendMessage(config.doctorTelegramId, `${prefix}\n${redactPersonalData(body)}\n\n${link}\n\nKo‘rildi: /seen_${ctx.chat.id}_${ctx.message.message_id}`);
}

async function checkConnection(ctx: Context): Promise<string> {
  const checks = await Promise.all([config.channelId, config.groupId].filter(Boolean).map(async (chatId) => {
    const member = await ctx.api.getChatMember(chatId!, ctx.me.id);
    const status = member.status === "administrator" || member.status === "creator" ? "✅" : "⚠️";
    return `${status} ${chatId}: ${member.status}`;
  }));
  const connections = checks.length ? checks.join("\n") : "Kanal va guruh IDlari sozlanmagan.";
  const schedules = (["post", "poll", "info"] as const).map((kind) => `${kind === "post" ? "Post" : kind === "poll" ? "Opros" : "Ma’lumot"}: ${config.postSchedules[kind].filter((item) => item.enabled).map((item) => item.time).join(", ") || "yo‘q"}`).join("\n");
  return `${connections}\n\n${schedules}\n(Toshkent vaqti)\nMavzular: ${config.contentTopics.length}\nOpenAI: ${config.openAiApiKey ? config.openAiModel : "API key kutilmoqda"}`;
}

function createBot() {
  if (!config.token) throw new Error("Telegram token berilmagan.");
  const bot = new Bot(config.token);
  bot.command("start", (ctx) => ctx.reply("Shifokor Bot tayyor. Kanal/guruhga admin qilib qo‘shing va /status bilan tekshiring."));
  bot.command("status", async (ctx) => ctx.reply(await checkConnection(ctx)));
  bot.command("pause", (ctx) => { runtime.paused = true; return ctx.reply("Autopost pauzaga qo‘yildi. Moderatsiya va shoshilinch signal davom etadi."); });
  bot.command("resume", (ctx) => { runtime.paused = false; return ctx.reply("Autopost davom ettirildi."); });
  bot.on("message", async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private" || !ctx.from) return;
    const text = messageText(ctx);
    if (!text) return;
    const protectedUser = await isProtected(ctx, ctx.from.id);
    const priorSameMessageCount = incrementMessage(runtime, ctx.from.id, normalizedText(text));
    const moderation = decideModeration({ text, priorSameMessageCount, allowedDomains: config.allowedDomains, isProtected: protectedUser });
    if (moderation.action !== "ALLOW") {
      await ctx.deleteMessage();
      if (moderation.action === "RESTRICT") {
        const until = Math.floor(Date.now() / 1000) + 15 * 60;
        await ctx.restrictChatMember(ctx.from.id, { can_send_messages: false }, { until_date: until });
      }
      console.info("moderation", { chatId: ctx.chat.id, messageId: ctx.message?.message_id, action: moderation.action, reason: moderation.reason });
      return;
    }
    const level = classifyTriage(text);
    if ((level === "URGENT" || isMedicalQuestion(text)) && ctx.message && rememberAlert(runtime, ctx.chat.id, ctx.message.message_id)) {
      try { await alertDoctor(ctx, level, text); }
      catch (error) { console.error("doctor_notification_failed", error); }
      if (level === "URGENT" && config.urgentGroupTemplate) await ctx.reply(config.urgentGroupTemplate);
    }
  });
  bot.catch((error) => console.error("telegram_update_failed", error.error));
  return bot;
}

function startPollingWhenConfigured() {
  config = loadConfig();
  if (!config.token) {
    console.info("Telegram token kutilmoqda. Uni adminka orqali saqlang.");
    return;
  }
  if (pollingStarted) return;
  pollingStarted = true;
  const bot = createBot();
  // Re-read encrypted admin settings immediately before each scheduling tick.
  // This prevents a post from using topics that were replaced in the dashboard.
  startPostScheduler(bot, loadConfig, () => runtime.paused);
  bot.start({ onStart: (info) => console.info(`@${info.username} polling boshlandi`) });
}

if (config.mode === "mock") {
  console.info("Shifokor bot mock rejimda. Haqiqiy Telegram uchun apps/bot/.env yarating va BOT_MODE=polling qiling.");
} else {
  startPollingWhenConfigured();
  setInterval(startPollingWhenConfigured, 30_000);
}
