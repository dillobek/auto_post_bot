export type ModerationReason = "LINK_SPAM" | "REPEATED_MESSAGE" | "MASS_MENTION";
export type ModerationDecision = { action: "ALLOW" } | { action: "DELETE" | "RESTRICT"; reason: ModerationReason };
export type TriageLevel = "NORMAL" | "URGENT";

const URL_SOURCE = "(?:https?:\\/\\/|t\\.me\\/|www\\.)[^\\s]+";
const MASS_MENTION = /(?:^|\s)@\w+/g;
const URGENT_PATTERNS = [
  /nafas (?:olish )?qiyin/i,
  /hush(?:idan)? ket/i,
  /ko['‘`]krak og['‘`]rig/i,
  /kuchli qon ket/i,
  /lab(?:i|lari) ko['‘`]kar/i,
  /tutqanoq/i,
];
const QUESTION_PATTERNS = [/\?/u, /\bdoktor\b/i, /\bshifokor\b/i, /qachon (?:bor|murojaat)/i, /mumkinmi/i];

export function normalizedText(text: string): string {
  return text.replace(new RegExp(URL_SOURCE, "gi"), "").replace(/\s+/g, " ").trim().toLocaleLowerCase("uz-UZ");
}

export function domainsIn(text: string): string[] {
  return Array.from(text.matchAll(new RegExp(URL_SOURCE, "gi")), ([url]) => {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    try { return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return ""; }
  }).filter(Boolean);
}

export function decideModeration(input: {
  text: string;
  priorSameMessageCount: number;
  allowedDomains: Set<string>;
  isProtected: boolean;
}): ModerationDecision {
  if (input.isProtected) return { action: "ALLOW" };
  const domains = domainsIn(input.text);
  if (domains.some((domain) => !input.allowedDomains.has(domain))) return { action: "DELETE", reason: "LINK_SPAM" };
  if ((input.text.match(MASS_MENTION) ?? []).length >= 5) return { action: "DELETE", reason: "MASS_MENTION" };
  if (normalizedText(input.text).length > 12 && input.priorSameMessageCount >= 1) return { action: "RESTRICT", reason: "REPEATED_MESSAGE" };
  return { action: "ALLOW" };
}

export function classifyTriage(text: string): TriageLevel {
  return URGENT_PATTERNS.some((pattern) => pattern.test(text)) ? "URGENT" : "NORMAL";
}

export function isMedicalQuestion(text: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

// Shaxsiy ma’lumotlar providerga yuborilishidan avval yashiriladi.
export function redactPersonalData(text: string): string {
  return text
    .replace(/\+?\d[\d\s()\-]{7,}\d/g, "[telefon]")
    .replace(/@\w{3,}/g, "[foydalanuvchi]")
    .replace(/\b\d{2}[./-]\d{2}[./-]\d{2,4}\b/g, "[sana]");
}
