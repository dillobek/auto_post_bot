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
type ContentContext = { topic: string; opening?: string; basedOnPollId?: string };

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

function isMedicalTopic(topic: string): boolean {
  return /\b(tibb(?:iyot|iy)?|medits(?:ina|inskiy)?|sog['‘’]?liq|salomatlik|bemor|shifokor|kasallik|davolash|dori|tashxis|diagnoz|klinika|kardiolog|pulmonolog|pediatr|stomatolog|ginekolog|jarroh|hamshira|psixiatr|terapiya|nevrolog|onkolog|endokrinolog|dermatolog|oftalmolog|urolog|gastroenterolog|nefrolog|immunolog|reumatolog|travmatolog|ortoped|akusher|reanimatolog|farmats)\b/i.test(topic);
}

function isAiTopic(topic: string): boolean {
  return /sun['‘’]?iy\s+intellekt|\bai\b|agent(?:lar)?\b/i.test(topic);
}

function hasUnexpectedAi(text: string, topic: string): boolean {
  return isMedicalTopic(topic) && !isAiTopic(topic) && /sun['‘’]?iy\s+intellekt|\bai\b|agent(?:lar)?\b/i.test(text);
}

function latestPostTopic(history: PostHistory): string | undefined {
  return [...(history.posts ?? [])].reverse().find((post) => post.kind === "post")?.topic;
}

function topicSignals(topic: string): string[] {
  const normalized = topic.toLocaleLowerCase();
  const specialty = normalized.includes("pediatr") ? ["pediatr"]
    : normalized.includes("pulmanolog") || normalized.includes("pulmonolog") ? ["pulman", "pulmon"]
      : normalized.includes("allergolog") ? ["allerg"] : [];
  const words = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length >= 4);
  return [...new Set([...specialty, ...words])];
}

function isGroundedInTopic(text: string, topic: string): boolean {
  const normalized = text.toLocaleLowerCase();
  return topicSignals(topic).some((signal) => normalized.includes(signal));
}

function isActiveTopic(config: BotConfig, topic: string): boolean {
  const normalized = topic.trim().toLocaleLowerCase();
  return config.contentTopics.some((item) => item.trim().toLocaleLowerCase() === normalized);
}

function pollOpening(poll: PollRecord): string | undefined {
  const largest = Math.max(...poll.votes);
  if (!largest) return undefined;
  if (poll.votes[0] === largest) return "Talablarga binoan ulashyapman.";
  if (poll.votes[1] === largest) return "Sizlarni bunday ma’lumotdan quruq qoldirgim kelmaydi.";
  return "Bu ma’lumot siz o‘ylaganingizdan ko‘ra qiziqarliroq.";
}

function contentContext(config: BotConfig, history: PostHistory, kind: ContentKind): ContentContext | undefined {
  if (kind === "post") return { topic: pickTopic(config, history, kind) };
  if (kind === "poll") {
    const previousTopic = latestPostTopic(history);
    return { topic: previousTopic && isActiveTopic(config, previousTopic) ? previousTopic : pickTopic(config, history, kind) };
  }
  const usedPolls = new Set((history.posts ?? []).filter((post) => post.kind === "info").flatMap((post) => post.basedOnPollId ? [post.basedOnPollId] : []));
  const poll = [...(history.polls ?? [])].reverse().find((item) => !usedPolls.has(item.id) && isActiveTopic(config, item.topic));
  return poll ? { topic: poll.topic, opening: pollOpening(poll) ?? "Keling, bu mavzuni batafsil ko‘rib chiqamiz.", basedOnPollId: poll.id } : undefined;
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
  const parts = ["Biz bilan bog‘lanish uchun quyidagi kontaktlarga murojaat qiling.", config.ctaAdminUsername?.trim() ? `👤 Admin: ${config.ctaAdminUsername.trim()}` : undefined, config.websiteUrl?.trim() ? `🌐 ${config.websiteUrl.trim()}` : undefined, config.phoneNumber?.trim() ? `📞 ${config.phoneNumber.trim()}` : undefined, config.additionalPhoneNumber?.trim() ? `📞 Qo‘shimcha: ${config.additionalPhoneNumber.trim()}` : undefined, config.instagramHandle?.trim() ? `📸 Instagram: ${config.instagramHandle.trim()}` : undefined].filter((value): value is string => Boolean(value));
  return parts.join("\n");
}

const engagementCta = "Siz bu haqda nima deb o‘ylaysiz? Fikringizni kommentariyada yozing.";

function cutAtSentence(value: string, limit: number): string {
  if (value.length <= limit) return value.trim();
  const clipped = value.slice(0, limit + 1);
  const lastSentence = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
  return (lastSentence > Math.floor(limit * 0.55) ? clipped.slice(0, lastSentence + 1) : clipped.slice(0, limit).replace(/\s+\S*$/, "").trim() + ".").trim();
}

function withoutEngagementLines(value: string): string {
  return value.split("\n").filter((line) => !/^\s*(?:siz bu haqda nima deb o['‘’]ylaysiz|fikringizni|fikrlaringizni|izoh(?:larda|da)|sizning fikringizni)/i.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function finalPost(body: string, config: BotConfig, maxLength: number): string {
  const contacts = contactCta(config);
  const reserved = contacts.length + (contacts ? 2 : 0) + engagementCta.length + 2;
  const contentBody = withoutEngagementLines(body);
  if (contentBody.length < 80) throw new Error("Yuborish uchun yetarli asosiy matn yaratilmagan.");
  const trimmedBody = cutAtSentence(contentBody, Math.max(300, maxLength - reserved));
  const parts = [trimmedBody, engagementCta, contacts].filter((value): value is string => Boolean(value));
  return parts.join("\n\n");
}

function fallbackContent(topic: string, kind: Exclude<ContentKind, "poll">, opening?: string): string {
  const medicalTopic = isMedicalTopic(topic);
  const firstLine = opening ?? (kind === "post" ? `${topic}: e’tiborli belgilarni o‘tkazib yubormang.` : `${topic} haqida muhim jihatlarni birga ko‘rib chiqamiz.`);
  if (medicalTopic) {
    if (kind === "post") return `${firstLine}\n\nAlomatlar takrorlansa, kuchaysa yoki kundalik hayotga xalaqit bersa, ularni e’tiborsiz qoldirmaslik kerak. Holatni kuzatish va mutaxassis bilan maslahatlashish to‘g‘ri yo‘l tanlashga yordam beradi.`;
    return `${firstLine}\n\n${topic}da birgina alomatga qarab xulosa qilish to‘g‘ri bo‘lmaydi. Belgilar qachon boshlanganini, nima kuchaytirishini va boshqa o‘zgarishlarni qayd etish shifokor bilan suhbatni ancha mazmunli qiladi.\n\nAyniqsa, holat takrorlansa, kuchaysa yoki uyqu, ishtaha, nafas olish va odatiy faollikka ta’sir qilsa, kechiktirmasdan mutaxassisga murojaat qiling. Erta e’tibor ko‘pincha vaziyatni to‘g‘ri baholashga yordam beradi.\n\nIjtimoiy tarmoqlardagi umumiy tavsiyalar ko‘rik o‘rnini bosa olmaydi. Har bir odamning holati alohida baholanadi.`;
  }
  if (kind === "post") return `${firstLine}\n\nBu yo‘nalishda kichik, izchil qadamlar ko‘pincha katta natija beradi. Avval amaliy ehtiyojni aniqlang, keyin uni sinab ko‘rib, natijaga qarab keyingi qadamni belgilang.`;
  return `${firstLine}\n\n${topic}ni tushunishda umumiy gaplardan ko‘ra amaliy savollar ko‘proq foyda beradi: muammo nimada, kimga ta’sir qiladi va birinchi qadam qanday bo‘lishi mumkin? Shu savollar mavzuni aniqroq ko‘rishga yordam beradi.\n\nKichik tajriba qiling, natijani kuzating va keyingi qarorni shunga tayang. Shunda mavzu nazariyada qolmay, kundalik hayotda foyda beradigan yechimga aylanadi.`;
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

async function askOpenAi(config: BotConfig, topic: string, kind: Exclude<ContentKind, "poll">, history: PostHistory, opening?: string, retry = false): Promise<string> {
  const medicalTopic = isMedicalTopic(topic);
  const aiTopic = isAiTopic(topic);
  const specialtyOnly = medicalTopic && !aiTopic;
  const domainRule = specialtyOnly
    ? "Bu tibbiy mutaxassislik mavzusi. Faqat shu mutaxassislikning bemor uchun amaliy, ehtiyotkor foydali jihatini yozing. Tashxis, individual davolash yoki dori dozasi bermang; yakuniy qaror shifokorniki ekanini qisqa va tabiiy ayting."
    : medicalTopic
      ? "Bu tibbiyot va sun’iy intellekt kesishmasidagi mavzu. AI faqat mavzu nomida aniq berilgan tibbiy vazifa doirasida yozilsin. Tashxis, individual davolash yoki dori dozasi bermang; yakuniy qaror shifokorniki ekanini qisqa va tabiiy ayting."
    : "Bu TIBBIY EMAS mavzu. Sog‘liq, bemor, shifokor, klinika, tashxis, davolash, dori yoki tibbiyotga oid misol va foydani mutlaqo kiritmang. AI yoki AI agent mavzusini texnologiya, ish jarayoni, avtomatlashtirish, mahsuldorlik, xavfsizlik yoki kundalik amaliyot nuqtai nazaridan yoritib bering.";
  const format = kind === "info"
    ? `Batafsil Telegram ma’lumotini yozing: ${opening ? `birinchi satr aynan shunday boshlansin: “${opening}”` : "birinchi satr diqqatni tortadigan, tabiiy kirish bo‘lsin."} Keyin 3–4 qisqa paragrafda muammo, sabab va amaliy yo‘lni tushuntiring. 650–1 200 belgi bo‘lsin. Muhokama chaqirig‘i, admin kontaktlari, manba, URL, Markdown yoki HTML yozmang.`
    : "Rasm ostiga qo‘yiladigan 220–420 belgilik qisqa Telegram posti yozing. Birinchi satr odamni to‘xtatib o‘qitadigan tabiiy savol yoki holat bo‘lsin. Keyin bir aniq foyda yoki oddiy misolni 2 qisqa paragrafda ayting. Muhokama chaqirig‘i, admin kontaktlari, manba, URL, Markdown yoki HTML yozmang.";
  const channelContext = specialtyOnly ? "O‘zbek tilidagi amaliy tibbiy kanal. Sodda, mehribon va ehtiyotkor tushuntirishlar." : config.channelContext?.trim() || "O‘zbek tilidagi amaliy va ishonchli mavzuli kanal.";
  const role = specialtyOnly ? "Siz kanal egasi nomidan tabiiy va puxta yozadigan o‘zbek Telegram kopirayterisiz." : "Siz kanal egasi nomidan tabiiy va puxta yozadigan o‘zbek Telegram kopirayterisiz. Matn avtomatik yaratilgani bilinmasin.";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openAiApiKey}` },
    body: JSON.stringify({
      model: config.openAiModel,
      store: false,
      max_output_tokens: 1200,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      instructions: `# Vazifa\n${role}\n\n# Faktlar\n- Avval web qidiruvdagi dolzarb, ishonchli ma’lumotni tekshiring. Tasdiqlanmagan fakt, statistika yoki vaqtga bog‘liq da’voni yozmang.\n- Agar yangi ma’lumot aniq bo‘lmasa, tekshiriladigan umumiy faktni tanlang.\n- ${domainRule}\n\n# Kanal ohangi\n- Kanal konteksti va auditoriyasiga mos yozing. O‘quvchini bevosita, samimiy va hurmat bilan gapga torting.\n- “muhim rol o‘ynaydi”, “inqilobiy o‘zgarish”, “bugungi kunda” kabi sun’iy, darslik uslubidagi iboralarni ishlatmang.\n- Bir aniq holat, muammo yoki kutilmagan savol bilan boshlang; keyin foydani sodda qilib oching. Bo‘rttirma va’dalar bermang.\n- Avvalgi kontentdagi sarlavha, kirish va asosiy fikrni takrorlamang.\n- Matnda manba, URL, admin kontakti, muhokama chaqirig‘i, HTML yoki Markdown yozmang.\n\n# Mavzuga sodiqlik\n- Sarlavha yoki birinchi satrda mavzu nomi aynan “${topic}” bo‘lsin. Butun matn faqat shu mavzuning amaliy jihatini yoritishi shart.\n\n# Qat’iy qoida\nKo‘rsatilgan format va soha chegarasiga so‘zsiz amal qiling.`,
      input: `Mavzu: ${topic}\nSoha turi: ${medicalTopic ? "tibbiyot" : "tibbiyot emas"}\nKanal konteksti: ${channelContext}\nKontent turi: ${kind}\n${format}\n${retry ? "Oldingi matn mavzuga yetarli bog‘lanmadi. Bu safar faqat shu mavzu doirasida yozing." : ""}\n\nQuyidagi shu mavzudagi avvalgi kontent allaqachon yuborilgan. Ulardan mutlaqo boshqa burchak tanlang:\n${previousFor(topic, kind, history)}`,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const payload = await response.json() as OpenAiResponse;
  const text = cleanGeneratedContent(outputText(payload));
  if (!text) throw new Error("OpenAI bo‘sh javob qaytardi.");
  const minLength = kind === "info" ? 450 : 180;
  const reason = text.length < minLength ? "yetarli emas" : !isGroundedInTopic(text, topic) ? "mavzuga bog‘lanmadi" : hasUnexpectedAi(text, topic) ? "mavzudan tashqari texnologiya atamasini ishlatdi" : undefined;
  if (reason) {
    if (!retry) return askOpenAi(config, topic, kind, history, opening, true);
    console.warn("content_generation_fallback", { topic, kind, reason });
    return fallbackContent(topic, kind, opening);
  }
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
    const question = "Yuqoridagi postning davomini — batafsil va amaliy ma’lumotini ulashaymi?";
    const sent = await bot.api.sendPoll(config.channelId!, question, [{ text: "Ha" }, { text: "Yo‘q" }, { text: "Qiziq emas" }], { is_anonymous: true });
    if (!sent.poll) throw new Error("Telegram opros ID sini qaytarmadi.");
    return { content: `${question}\nHa | Yo‘q | Qiziq emas`, pollId: sent.poll.id };
  }
  let generated: string;
  try { generated = await askOpenAi(config, topic, kind, history, opening); }
  catch (error) {
    console.error("content_generation_failed_using_fallback", error);
    generated = fallbackContent(topic, kind, opening);
  }
  const post = finalPost(generated, config, kind === "post" ? 950 : 1_700);
  if (kind === "post") {
    try { await bot.api.sendPhoto(config.channelId!, await generateImage(config, topic, generated), { caption: telegramHtml(post), parse_mode: "HTML" }); }
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
    const context = contentContext(config, history, next.kind);
    if (!context) {
      console.info("scheduled_content_waiting_for_poll", { kind: next.kind, time: next.time });
      return;
    }
    inFlight = true;
    const key = `${now.date}-${next.kind}-${next.time}`;
    try {
      const result = await sendContent(bot, config, next.kind, context.topic, history, context.opening, context.basedOnPollId);
      await rememberSent(history, { key, topic: context.topic, kind: next.kind, content: result.content, pollId: result.pollId, basedOnPollId: result.basedOnPollId, createdAt: new Date().toISOString() });
      console.info("scheduled_content_sent", { key, topic: context.topic, kind: next.kind, channelId: config.channelId });
    } catch (error) { console.error("scheduled_content_failed", error); }
    finally { inFlight = false; }
  };
  void tick();
  setInterval(() => void tick(), 30_000);
}
