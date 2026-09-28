import { Bot, InputFile } from "grammy";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BotConfig } from "./config.js";

type ContentKind = "post" | "poll" | "info";
type SentContent = { key: string; topic: string; kind: ContentKind; content: string; createdAt: string };
type PostHistory = { sent: Record<string, true>; posts?: SentContent[] };
type OpenAiResponse = { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
type ImageResponse = { data?: Array<{ b64_json?: string }> };
type Poll = { question: string; options: string[] };

const historyPath = process.env.SHIFOKOR_POST_HISTORY_FILE ?? path.resolve(process.cwd(), "../../data/post-history.json");
const officialDomains = ["www.who.int", "www.cdc.gov", "medlineplus.gov", "www.nhs.uk", "pubmed.ncbi.nlm.nih.gov", "www.fda.gov"];

function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts();
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

async function readHistory(): Promise<PostHistory> {
  try { const value = JSON.parse(await readFile(historyPath, "utf8")) as PostHistory; return { sent: value.sent ?? {}, posts: value.posts ?? [] }; }
  catch { return { sent: {}, posts: [] }; }
}

async function rememberSent(history: PostHistory, entry: SentContent): Promise<void> {
  history.sent[entry.key] = true;
  history.posts = [...(history.posts ?? []), entry];
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  for (const existing of Object.keys(history.sent)) if (existing.slice(0, 10) < cutoff.slice(0, 10)) delete history.sent[existing];
  history.posts = history.posts.filter((post) => post.createdAt >= cutoff).slice(-300);
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history), { encoding: "utf8", mode: 0o600 });
}

function pickTopic(config: BotConfig, history: PostHistory, kind: ContentKind): string {
  const sentForKind = (history.posts ?? []).filter((post) => post.kind === kind).length;
  return config.contentTopics[sentForKind % config.contentTopics.length]!;
}

function outputText(response: OpenAiResponse): string {
  if (response.output_text) return response.output_text.trim();
  return response.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && item.text).map((item) => item.text).join("\n").trim() ?? "";
}

function contactCta(config: BotConfig): string {
  const parts = [config.contentCta?.trim(), config.ctaAdminUsername?.trim() ? `Admin: ${config.ctaAdminUsername.trim()}` : undefined, config.websiteUrl?.trim() ? `Website: ${config.websiteUrl.trim()}` : undefined, config.phoneNumber?.trim() ? `Tel: ${config.phoneNumber.trim()}` : undefined, config.additionalPhoneNumber?.trim() ? `Qo‘shimcha tel: ${config.additionalPhoneNumber.trim()}` : undefined, config.instagramHandle?.trim() ? `Instagram: ${config.instagramHandle.trim()}` : undefined].filter((value): value is string => Boolean(value));
  return parts.join("\n");
}

function finalPost(body: string, config: BotConfig): string {
  const parts = [body.trim(), contactCta(config)];
  return parts.filter(Boolean).join("\n\n").slice(0, 950);
}

function previousFor(topic: string, kind: ContentKind, history: PostHistory): string {
  const normalized = topic.trim().toLocaleLowerCase();
  const items = (history.posts ?? []).filter((post) => post.kind === kind && post.topic.trim().toLocaleLowerCase() === normalized).slice(-7);
  return items.length ? items.map((post, index) => `${index + 1}. ${post.content.replace(/\s+/g, " ").slice(0, 380)}`).join("\n") : "Yo‘q";
}

async function askOpenAi(config: BotConfig, topic: string, kind: ContentKind, history: PostHistory): Promise<string> {
  const format = kind === "poll" ? "Faqat quyidagi JSONni qaytaring: {\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\"]}. Savol 300 belgidan, har variant 100 belgidan oshmasin; 2-6 variant bo‘lsin." : kind === "info" ? "350 belgidan oshmaydigan qisqa foydali ma’lumot yozing: sarlavha va 2-3 qisqa satr. CTA, manba, havola yozmang." : "Sarlavha va ko‘pi bilan 2 qisqa paragrafdan iborat, 600 belgidan oshmaydigan foydali post yozing. CTA, manba, havola yozmang.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({
      model: config.openAiModel,
      store: false,
      max_output_tokens: kind === "poll" ? 300 : 750,
      // gpt-4.1-mini supports Responses web search but rejects the optional
      // domain-filter parameter. The instruction below still requires official
      // sources, while keeping the configured economical model operational.
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      instructions: `Siz o‘zbek tilida yozadigan professional kontent muharririsiz. Mavzu qaysi sohada berilsa, faqat shu sohaga oid, aniq va sodda kontent yozing. Avval ishonchli rasmiy manbalardan web qidiruv qiling (ustuvor domenlar: ${officialDomains.join(", ")}). Faqat sog‘liq mavzusida tashxis, individual davolash yoki dori dozasi bermang. Avvalgi kontentdagi burchak, sarlavha va fikrlarni takrorlamang. Matnda manba, URL yoki iqtibos yozmang.`,
      input: `Mavzu: ${topic}\nKontent turi: ${kind}\n${format}\n\nQuyidagi shu mavzudagi avvalgi postlar allaqachon yuborilgan. Ulardan mutlaqo boshqa kichik mavzu/burchak tanlang:\n${previousFor(topic, kind, history)}`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json() as OpenAiResponse;
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI bo‘sh javob qaytardi.");
  return text;
}

async function generateImage(config: BotConfig, topic: string, post: string): Promise<InputFile> {
  const prompt = `Create a polished square editorial illustration for a Telegram post about “${topic}”. The image must clearly match this Uzbek post’s idea: “${post.slice(0, 500)}”. Modern, clean, relevant visual storytelling, professional lighting and composition. No text, no letters, no numbers, no logos, no watermarks, no brand names, no user-interface elements.`;
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1024x1024", quality: "low", output_format: "jpeg", output_compression: 82 }),
  });
  if (!response.ok) throw new Error(`OpenAI image ${response.status}: ${await response.text()}`);
  const image = (await response.json() as ImageResponse).data?.[0]?.b64_json;
  if (!image) throw new Error("OpenAI rasm qaytarmadi.");
  return new InputFile(Buffer.from(image, "base64"), "autopost.jpg");
}

function parsePoll(text: string): Poll {
  const raw = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const value = JSON.parse(raw) as Partial<Poll>;
  const question = value.question?.trim();
  const options = value.options?.map((option) => option.trim()).filter(Boolean) ?? [];
  if (!question || question.length > 300 || options.length < 2 || options.length > 6 || options.some((option) => option.length > 100)) throw new Error("OpenAI yaroqsiz so‘rovnoma qaytardi.");
  return { question, options };
}

async function sendContent(bot: Bot, config: BotConfig, kind: ContentKind, topic: string, history: PostHistory): Promise<string> {
  const generated = await askOpenAi(config, topic, kind, history);
  if (kind === "poll") {
    const poll = parsePoll(generated);
    await bot.api.sendPoll(config.channelId!, poll.question, poll.options.map((text) => ({ text })), { is_anonymous: true });
    return `${poll.question}\n${poll.options.join(" | ")}`;
  }
  const post = finalPost(generated, config);
  if (kind === "post") {
    try { await bot.api.sendPhoto(config.channelId!, await generateImage(config, topic, post), { caption: post }); }
    catch (error) { console.error("scheduled_image_failed", error); await bot.api.sendMessage(config.channelId!, post, { link_preview_options: { is_disabled: true } }); }
  } else await bot.api.sendMessage(config.channelId!, post, { link_preview_options: { is_disabled: true } });
  return post;
}

export function startPostScheduler(bot: Bot, getConfig: () => BotConfig, isPaused: () => boolean): void {
  let inFlight = false;
  const tick = async () => {
    if (inFlight || isPaused()) return;
    const config = getConfig();
    if (!config.channelId || !config.openAiApiKey || !config.contentTopics.length) return;
    const now = tashkentNow();
    const due = (["post", "poll", "info"] as ContentKind[]).flatMap((kind) => config.postSchedules[kind].filter((item) => item.enabled && item.time === now.time).map((item) => ({ kind, time: item.time })));
    if (!due.length) return;
    const history = await readHistory();
    const next = due.find((item) => !history.sent[`${now.date}-${item.kind}-${item.time}`]);
    if (!next) return;
    inFlight = true;
    const key = `${now.date}-${next.kind}-${next.time}`;
    try {
      const topic = pickTopic(config, history, next.kind);
      const content = await sendContent(bot, config, next.kind, topic, history);
      await rememberSent(history, { key, topic, kind: next.kind, content, createdAt: new Date().toISOString() });
      console.info("scheduled_content_sent", { key, topic, kind: next.kind, channelId: config.channelId });
    } catch (error) { console.error("scheduled_content_failed", error); }
    finally { inFlight = false; }
  };
  void tick();
  setInterval(() => void tick(), 30_000);
}
