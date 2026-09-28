import { Bot } from "grammy";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BotConfig } from "./config.js";

type ContentKind = "post" | "poll" | "info";
type SentContent = { key: string; topic: string; kind: ContentKind; content: string; createdAt: string };
type PostHistory = { sent: Record<string, true>; posts?: SentContent[] };
type OpenAiResponse = { output_text?: string; output?: Array<{ type?: string; action?: { sources?: Array<{ url?: string }> }; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url_citation?: { url?: string } }> }> }> };
type GeneratedContent = { text: string; sourceUrls: string[] };
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

function citedUrls(response: OpenAiResponse): string[] {
  const urls = response.output?.flatMap((item) => [
    ...(item.action?.sources?.map((source) => source.url) ?? []),
    ...(item.content?.flatMap((content) => content.annotations?.map((annotation) => annotation.url_citation?.url) ?? []) ?? []),
  ]) ?? [];
  return [...new Set(urls.filter((url): url is string => Boolean(url && /^https:\/\//.test(url))))].slice(0, 2);
}

function contactCta(config: BotConfig): string {
  const parts = [config.contentCta?.trim(), config.ctaAdminUsername?.trim() ? `Admin: ${config.ctaAdminUsername.trim()}` : undefined, config.websiteUrl?.trim() ? `Website: ${config.websiteUrl.trim()}` : undefined, config.phoneNumber?.trim() ? `Tel: ${config.phoneNumber.trim()}` : undefined, config.additionalPhoneNumber?.trim() ? `Qo‘shimcha tel: ${config.additionalPhoneNumber.trim()}` : undefined, config.instagramHandle?.trim() ? `Instagram: ${config.instagramHandle.trim()}` : undefined].filter((value): value is string => Boolean(value));
  return parts.join("\n");
}

function finalPost(body: string, config: BotConfig, officialSourceUrls: string[]): string {
  const parts = [body.trim(), contactCta(config)];
  const sources = [...officialSourceUrls, ...config.sourceUrls].filter((value, index, all) => all.indexOf(value) === index).slice(0, 4);
  if (sources.length) parts.push(`Manbalar:\n${sources.map((url) => `• ${url}`).join("\n")}`);
  return parts.filter(Boolean).join("\n\n").slice(0, 4096);
}

function previousFor(topic: string, kind: ContentKind, history: PostHistory): string {
  const normalized = topic.trim().toLocaleLowerCase();
  const items = (history.posts ?? []).filter((post) => post.kind === kind && post.topic.trim().toLocaleLowerCase() === normalized).slice(-7);
  return items.length ? items.map((post, index) => `${index + 1}. ${post.content.replace(/\s+/g, " ").slice(0, 380)}`).join("\n") : "Yo‘q";
}

async function askOpenAi(config: BotConfig, topic: string, kind: ContentKind, history: PostHistory): Promise<GeneratedContent> {
  const format = kind === "poll" ? "Faqat quyidagi JSONni qaytaring: {\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\"]}. Savol 300 belgidan, har variant 100 belgidan oshmasin; 2-6 variant bo‘lsin." : kind === "info" ? "500 belgidan oshmaydigan qisqa foydali ma’lumot yozing: sarlavha va 2-4 qisqa satr. CTA yoki manba yozmang." : "900 belgidan oshmaydigan foydali post yozing: sarlavha va qisqa, aniq paragraflar. CTA yoki manba yozmang.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({
      model: config.openAiModel,
      store: false,
      max_output_tokens: kind === "poll" ? 300 : 750,
      tools: [{ type: "web_search", search_context_size: "medium", filters: { allowed_domains: officialDomains } }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      instructions: "Siz o‘zbek tilida yozadigan tibbiy kontent muharririsiz. Avval rasmiy tibbiy manbalardan web qidiruv qiling. Faqat ommaviy ma’rifiy, ehtiyotkor kontent yozing; tashxis, individual davolash yoki dori dozasi bermang. Jiddiy yoki shoshilinch simptomlar bo‘lsa shifokorga yoki tez yordamga murojaat qilishni eslating. Avvalgi kontentdagi burchak, sarlavha va fikrlarni takrorlamang.",
      input: `Mavzu: ${topic}\nKontent turi: ${kind}\n${format}\n\nQuyidagi shu mavzudagi avvalgi postlar allaqachon yuborilgan. Ulardan mutlaqo boshqa kichik mavzu/burchak tanlang:\n${previousFor(topic, kind, history)}`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json() as OpenAiResponse;
  const text = outputText(payload);
  if (!text) throw new Error("OpenAI bo‘sh javob qaytardi.");
  return { text, sourceUrls: citedUrls(payload) };
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
    const poll = parsePoll(generated.text);
    await bot.api.sendPoll(config.channelId!, poll.question, poll.options.map((text) => ({ text })), { is_anonymous: true });
    return `${poll.question}\n${poll.options.join(" | ")}`;
  }
  const post = finalPost(generated.text, config, generated.sourceUrls);
  await bot.api.sendMessage(config.channelId!, post, { link_preview_options: { is_disabled: true } });
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
