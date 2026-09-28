import { Bot } from "grammy";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BotConfig } from "./config.js";

type PostHistory = { sent: Record<string, true> };
type OpenAiResponse = { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };

const historyPath = process.env.SHIFOKOR_POST_HISTORY_FILE ?? path.resolve(process.cwd(), "../../data/post-history.json");

function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts();
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

async function readHistory(): Promise<PostHistory> {
  try { return JSON.parse(await readFile(historyPath, "utf8")) as PostHistory; }
  catch { return { sent: {} }; }
}

async function rememberSent(history: PostHistory, key: string): Promise<void> {
  history.sent[key] = true;
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const existing of Object.keys(history.sent)) if (existing.slice(0, 10) < cutoff) delete history.sent[existing];
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history), { encoding: "utf8", mode: 0o600 });
}

function pickTopic(config: BotConfig, history: PostHistory): string {
  const index = Object.keys(history.sent).length % config.contentTopics.length;
  return config.contentTopics[index]!;
}

function outputText(response: OpenAiResponse): string {
  if (response.output_text) return response.output_text.trim();
  return response.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && item.text).map((item) => item.text).join("\n").trim() ?? "";
}

function finalPost(body: string, config: BotConfig): string {
  const parts = [body.trim()];
  if (config.contentCta) parts.push(config.contentCta.trim());
  if (config.sourceUrls.length) parts.push(`Manbalar:\n${config.sourceUrls.map((url) => `• ${url}`).join("\n")}`);
  return parts.join("\n\n").slice(0, 4096);
}

async function generatePost(config: BotConfig, topic: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({
      model: config.openAiModel,
      store: false,
      max_output_tokens: 650,
      instructions: "Siz o‘zbek tilida yozadigan tibbiy kontent muharririsiz. Faqat ommaviy ma’rifiy post yozing. Tashxis qo‘ymang, dori dozasini yoki individual davolashni tavsiya qilmang. Shoshilinch simptomlar bo‘lsa shifokorga yoki tez yordamga murojaat qilishni eslating. Sarlavha va qisqa, aniq paragraflardan foydalaning. CTA yoki manbalar ro‘yxatini yozmang.",
      input: `Mavzu: ${topic}\nTelegram kanali uchun 900 belgidan oshmaydigan foydali post tayyorlang.`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const text = outputText(await response.json() as OpenAiResponse);
  if (!text) throw new Error("OpenAI bo‘sh javob qaytardi.");
  return finalPost(text, config);
}

export function startPostScheduler(bot: Bot, getConfig: () => BotConfig, isPaused: () => boolean): void {
  let inFlight = false;
  const tick = async () => {
    if (inFlight || isPaused()) return;
    const config = getConfig();
    if (!config.channelId || !config.openAiApiKey || !config.contentTopics.length || !config.postSchedule.some((item) => item.enabled)) return;
    const now = tashkentNow();
    const scheduled = config.postSchedule.find((item) => item.enabled && item.time === now.time);
    if (!scheduled) return;
    const key = `${now.date}-${scheduled.time}`;
    const history = await readHistory();
    if (history.sent[key]) return;
    inFlight = true;
    try {
      const topic = pickTopic(config, history);
      const post = await generatePost(config, topic);
      await bot.api.sendMessage(config.channelId, post, { link_preview_options: { is_disabled: true } });
      await rememberSent(history, key);
      console.info("scheduled_post_sent", { key, topic, channelId: config.channelId });
    } catch (error) {
      console.error("scheduled_post_failed", error);
    } finally {
      inFlight = false;
    }
  };
  void tick();
  setInterval(() => void tick(), 30_000);
}
