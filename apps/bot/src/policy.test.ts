import assert from "node:assert/strict";
import { classifyTriage, decideModeration, redactPersonalData } from "./policy.js";

const allowed = new Set(["clinic.uz"]);
assert.deepEqual(decideModeration({ text: "https://clinic.uz/qabul", priorSameMessageCount: 0, allowedDomains: allowed, isProtected: false }), { action: "ALLOW" });
assert.deepEqual(decideModeration({ text: "https://spam.example/bonus", priorSameMessageCount: 0, allowedDomains: allowed, isProtected: false }), { action: "DELETE", reason: "LINK_SPAM" });
assert.deepEqual(decideModeration({ text: "Tekshirib ko‘ring iltimos", priorSameMessageCount: 1, allowedDomains: allowed, isProtected: false }), { action: "RESTRICT", reason: "REPEATED_MESSAGE" });
assert.deepEqual(decideModeration({ text: "https://spam.example", priorSameMessageCount: 0, allowedDomains: allowed, isProtected: true }), { action: "ALLOW" });
assert.equal(classifyTriage("bolada nafas olish qiyin"), "URGENT");
assert.equal(classifyTriage("bugun allergiya bor"), "NORMAL");
assert.equal(redactPersonalData("@aziz 998 90 123 45 67"), "[foydalanuvchi] [telefon]");
console.info("policy tests passed");
