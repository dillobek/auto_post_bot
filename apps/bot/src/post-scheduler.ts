import { Bot, InputFile } from "grammy";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BotConfig } from "./config.js";

type ContentKind = "post" | "poll" | "info";
type SentContent = { key: string; topic: string; kind: ContentKind; content: string; createdAt: string; pollId?: string; basedOnPollId?: string };
type PollRecord = { id: string; topic: string; createdAt: string; votes: [number, number, number] };
type PostHistory = { sent: Record<string, true>; posts?: SentContent[]; polls?: PollRecord[] };
type OpenAiResponse = { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
type ImageResponse = { data?: Array<{ b64_json?: string }> };
type ContentResult = { content: string; pollId?: string; basedOnPollId?: string };

const historyPath = process.env.SHIFOKOR_POST_HISTORY_FILE ?? path.resolve(process.cwd(), "../../data/post-history.json");

function tashkentNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts();
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

async function readHistory(): Promise<PostHistory> {
  try { const value = JSON.parse(await readFile(historyPath, "utf8")) as PostHistory; return { sent: value.sent ?? {}, posts: value.posts ?? [], polls: value.polls ?? [] }; }
  catch { return { sent: {}, posts: [], polls: [] }; }
}

async function persistHistory(history: PostHistory): Promise<void> {
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history), { encoding: "utf8", mode: 0o600 });
}

async function rememberSent(history: PostHistory, entry: SentContent): Promise<void> {
  history.sent[entry.key] = true;
  history.posts = [...(history.posts ?? []), entry];
  if (entry.pollId) history.polls = [...(history.polls ?? []), { id: entry.pollId, topic: entry.topic, createdAt: entry.createdAt, votes: [0, 0, 0] }];
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  for (const existing of Object.keys(history.sent)) if (existing.slice(0, 10) < cutoff.slice(0, 10)) delete history.sent[existing];
  history.posts = history.posts.filter((post) => post.createdAt >= cutoff).slice(-300);
  history.polls = (history.polls ?? []).filter((poll) => poll.createdAt >= cutoff).slice(-100);
  await persistHistory(history);
}

async function rememberPollVotes(pollId: string, counts: number[]): Promise<void> {
  const history = await readHistory();
  const poll = history.polls?.find((item) => item.id === pollId);
  if (!poll) return;
  poll.votes = [counts[0] ?? 0, counts[1] ?? 0, counts[2] ?? 0];
  await persistHistory(history);
}

function pickTopic(config: BotConfig, history: PostHistory, kind: ContentKind): string {
  const sentForKind = (history.posts ?? []).filter((post) => post.kind === kind).length;
  return config.contentTopics[sentForKind % config.contentTopics.length]!;
}

function latestPostTopic(history: PostHistory): string | undefined {
  return [...(history.posts ?? [])].reverse().find((post) => post.kind === "post")?.topic;
}

function pollOpening(poll: PollRecord): string | undefined {
  const largest = Math.max(...poll.votes);
  if (!largest) return undefined;
  if (poll.votes[0] === largest) return "Talablarga binoan ulashyapman.";
  if (poll.votes[1] === largest) return "Sizlarni bunday ma’lumotdan quruq qoldirgim kelmaydi.";
  return "Bu ma’lumot siz o‘ylaganingizdan ko‘ra qiziqarliroq.";
}

function contentContext(config: BotConfig, history: PostHistory, kind: ContentKind): { topic: string; opening?: string; basedOnPollId?: string } {
  if (kind === "poll") return { topic: latestPostTopic(history) ?? pickTopic(config, history, kind) };
  if (kind === "post") {
    const usedPolls = new Set((history.posts ?? []).flatMap((post) => post.basedOnPollId ? [post.basedOnPollId] : []));
    const poll = [...(history.polls ?? [])].reverse().find((item) => !usedPolls.has(item.id) && pollOpening(item));
    if (poll) return { topic: poll.topic, opening: pollOpening(poll), basedOnPollId: poll.id };
  }
  return { topic: pickTopic(config, history, kind) };
}

function outputText(response: OpenAiResponse): string {
  if (response.output_text) return response.output_text.trim();
  return response.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && item.text).map((item) => item.text).join("\n").trim() ?? "";
}

function cleanGeneratedContent(value: string): string {
  return value
    .replace(/\s*\[[^\]]+\]\(https?:\/\/[^)]+\)/gi, "")
    .replace(/\s*\(https?:\/\/[^)]+\)/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_`]/g, "")
    .split("\n").filter((line) => !/^\s*(manba|sources?|reference|•\s*https?:)/i.test(line)).join("\n")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function contactCta(config: BotConfig): string {
  const parts = [config.contentCta?.trim().slice(0, 180), "Biz bilan bog‘lanish uchun quyidagi kontaktlarga murojaat qiling.", config.ctaAdminUsername?.trim() ? `👤 Admin: ${config.ctaAdminUsername.trim()}` : undefined, config.websiteUrl?.trim() ? `🌐 ${config.websiteUrl.trim()}` : undefined, config.phoneNumber?.trim() ? `📞 ${config.phoneNumber.trim()}` : undefined, config.additionalPhoneNumber?.trim() ? `📞 Qo‘shimcha: ${config.additionalPhoneNumber.trim()}` : undefined, config.instagramHandle?.trim() ? `📸 Instagram: ${config.instagramHandle.trim()}` : undefined].filter((value): value is string => Boolean(value));
  return parts.join("\n");
}

const engagementCta = "Siz bu haqda nima deb o‘ylaysiz? Fikringizni kommentariyada yozing.";

function cutAtSentence(value: string, limit: number): string {
  if (value.length <= limit) return value.trim();
  const clipped = value.slice(0, limit + 1);
  const lastSentence = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return (lastSentence > Math.floor(limit * 0.55) ? clipped.slice(0, lastSentence + 1) : clipped.slice(0, limit).replace(/\s+\S*$/, "").trim() + ".").trim();
}

function finalPost(body: string, config: BotConfig): string {
  const contacts = contactCta(config);
  const hasEngagement = /fikringizni|izoh(?:larda|da)|kommentariyada/i.test(body);
  const reserved = contacts.length + (contacts ? 2 : 0) + (hasEngagement ? 0 : engagementCta.length + 2);
  const trimmedBody = cutAtSentence(body.trim(), Math.max(300, 950 - reserved));
  const parts = [trimmedBody, hasEngagement ? undefined : engagementCta, contacts].filter((value): value is string => Boolean(value));
  return parts.join("\n\n");
}

function telegramHtml(post: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = post.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const [headline, ...rest] = lines;
  return headline ? `<b>${escape(headline)}</b>${rest.length ? `\n\n${escape(rest.join("\n\n"))}` : ""}` : "";
}

function previousFor(topic: string, kind: ContentKind, history: PostHistory): string {
  const normalized = topic.trim().toLocaleLowerCase();
  const items = (history.posts ?? []).filter((post) => post.kind === kind && post.topic.trim().toLocaleLowerCase() === normalized).slice(-7);
  return items.length ? items.map((post, index) => `${index + 1}. ${post.content.replace(/\s+/g, " ").slice(0, 380)}`).join("\n") : "Yo‘q";
}

async function askOpenAi(config: BotConfig, topic: string, kind: Exclude<ContentKind, "poll">, history: PostHistory, opening?: string): Promise<string> {
  const format = kind === "info" ? "300 belgidan oshmaydigan qisqa foydali ma’lumot yozing: sarlavha va 2 qisqa satr. CTA, manba, havola yozmang." : `520 belgidan oshmaydigan Telegram posti yozing. ${opening ? `Birinchi satr aynan shunday boshlansin: “${opening}”` : "Birinchi satr — qiziqarli, odamlarga tanish savol yoki muammo."} Keyin ko‘pi bilan 2 qisqa paragrafda aniq foyda yozing; har bir gap 160 belgidan oshmasin; sog‘liq mavzusida shifokor qarori muhimligi haqidagi bitta mas’uliyatli jumla yozing. Oxirgi satr aynan shunday bo‘lsin: “Siz bu haqda nima deb o‘ylaysiz? Fikringizni kommentariyada yozing.” Admin kontaktlari, manba, URL, Markdown yoki HTML yozmang.`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({
      model: config.openAiModel,
      store: false,
      max_output_tokens: 750,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      instructions: "# Role\nSiz o‘zbek tilida yozadigan professional Telegram kontent muharririsiz.\n\n# Fact safety\n- Faqat mustahkam, umumiy tan olingan ma’lumotni yozing. Ishonchingiz bo‘lmagan fakt, statistika, tashxis, individual davolash va dori dozasini yozmang.\n- Sog‘liq mavzusida shifokor nazorati chegarasini aniq ayting.\n\n# Writing rules\n- Mavzu qaysi sohada berilsa, faqat shu sohaga oid, amaliy va sodda kontent yozing.\n- Umumiy darslik uslubidagi “muhim rol o‘ynaydi”, “inqilobiy o‘zgarish” kabi bo‘sh iboralarni ishlatmang.\n- O‘quvchini gapga tortadigan savol, aniq foyda va yakuniy muhokama savoli bo‘lsin.\n- Avvalgi kontentdagi burchak, sarlavha va fikrlarni takrorlamang.\n- Matnda manba, URL, admin kontakti, HTML yoki Markdown yozmang.\n\n# Final instruction\nKo‘rsatilgan chiqish formatiga so‘zsiz amal qiling.",
      input: `Mavzu: ${topic}\nKontent turi: ${kind}\n${format}\n\nQuyidagi shu mavzudagi avvalgi postlar allaqachon yuborilgan. Ulardan mutlaqo boshqa kichik mavzu/burchak tanlang:\n${previousFor(topic, kind, history)}`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json() as OpenAiResponse;
  const text = cleanGeneratedContent(outputText(payload));
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

async function sendContent(bot: Bot, config: BotConfig, kind: ContentKind, topic: string, history: PostHistory, opening?: string, basedOnPollId?: string): Promise<ContentResult> {
  if (kind === "poll") {
    const question = `“${topic}” mavzusini davom ettirib, amaliy ma’lumot ulashaymi?`;
    const sent = await bot.api.sendPoll(config.channelId!, question, [{ text: "Ha" }, { text: "Yo‘q" }, { text: "Qiziq emas" }], { is_anonymous: true });
    if (!sent.poll) throw new Error("Telegram opros ID sini qaytarmadi.");
    return { content: `${question}\nHa | Yo‘q | Qiziq emas`, pollId: sent.poll.id };
  }
  const generated = await askOpenAi(config, topic, kind, history, opening);
  const post = finalPost(generated, config);
  if (kind === "post") {
    try { await bot.api.sendPhoto(config.channelId!, await generateImage(config, topic, post), { caption: telegramHtml(post), parse_mode: "HTML" }); }
    catch (error) { console.error("scheduled_image_failed", error); await bot.api.sendMessage(config.channelId!, telegramHtml(post), { parse_mode: "HTML", link_preview_options: { is_disabled: true } }); }
  } else await bot.api.sendMessage(config.channelId!, post, { link_preview_options: { is_disabled: true } });
  return { content: post, basedOnPollId };
}

export function startPostScheduler(bot: Bot, getConfig: () => BotConfig, isPaused: () => boolean): void {
  let inFlight = false;
  bot.on("poll", async (ctx) => {
    try { await rememberPollVotes(ctx.poll.id, ctx.poll.options.map((option) => option.voter_count)); }
    catch (error) { console.error("poll_results_store_failed", error); }
  });
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
      const context = contentContext(config, history, next.kind);
      const result = await sendContent(bot, config, next.kind, context.topic, history, context.opening, context.basedOnPollId);
      await rememberSent(history, { key, topic: context.topic, kind: next.kind, content: result.content, pollId: result.pollId, basedOnPollId: result.basedOnPollId, createdAt: new Date().toISOString() });
      console.info("scheduled_content_sent", { key, topic: context.topic, kind: next.kind, channelId: config.channelId });
    } catch (error) { console.error("scheduled_content_failed", error); }
    finally { inFlight = false; }
  };
  void tick();
  setInterval(() => void tick(), 30_000);
}
