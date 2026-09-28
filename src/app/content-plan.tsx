"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type ContentPlan = { contentTopics: string[]; contentCta: string; sourceUrls: string[] };

const emptyPlan: ContentPlan = { contentTopics: [], contentCta: "", sourceUrls: [] };

export function ContentPlanSetup() {
  const [plan, setPlan] = useState<ContentPlan>(emptyPlan);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/telegram-settings")
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((value: ContentPlan) => setPlan({ contentTopics: value.contentTopics ?? [], contentCta: value.contentCta ?? "", sourceUrls: value.sourceUrls ?? [] }))
      .catch(() => setMessage("Kontent sozlamalarini yuklab bo‘lmadi."));
  }, []);

  function addTopic() {
    const value = topic.trim();
    if (!value || plan.contentTopics.includes(value)) return;
    setPlan((current) => ({ ...current, contentTopics: [...current.contentTopics, value] }));
    setTopic("");
  }

  function addSource() {
    const value = source.trim();
    if (!value || plan.sourceUrls.includes(value)) return;
    setPlan((current) => ({ ...current, sourceUrls: [...current.sourceUrls, value] }));
    setSource("");
  }

  function addOnEnter(event: KeyboardEvent<HTMLInputElement>, add: () => void) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/telegram-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
    const result = await response.json() as ContentPlan & { error?: string };
    setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "Kontent sozlamalarini saqlab bo‘lmadi."); return; }
    setPlan({ contentTopics: result.contentTopics ?? [], contentCta: result.contentCta ?? "", sourceUrls: result.sourceUrls ?? [] });
    setMessage("Mavzular, CTA va manbalar saqlandi.");
  }

  return <section className={styles.settingsPage}><div className={styles.settingsIntro}><div><h1>Kontent rejasi</h1><p>Mavzular, post oxiridagi chaqiriq va ishonchli manbalarni shu yerda saqlang.</p></div><span className={plan.contentTopics.length || plan.contentCta || plan.sourceUrls.length ? styles.connectedBadge : styles.needsSetup}>{plan.contentTopics.length} mavzu · {plan.sourceUrls.length} manba</span></div><form className={styles.settingsForm} onSubmit={save}><section className={styles.settingsSection}><h2>Mavzular</h2><div className={styles.addRow}><input value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => addOnEnter(event, addTopic)} placeholder="Masalan: bolalarda mavsumiy allergiya" maxLength={120} /><button type="button" className={styles.outlineButton} onClick={addTopic}>Qo‘shish</button></div><div className={styles.tagList}>{plan.contentTopics.length ? plan.contentTopics.map((item) => <span className={styles.tag} key={item}>{item}<button type="button" aria-label={`${item} mavzusini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, contentTopics: current.contentTopics.filter((value) => value !== item) }))}>×</button></span>) : <span className={styles.emptyInline}>Hali mavzu kiritilmagan.</span>}</div></section><section className={styles.settingsSection}><h2>Post CTA</h2><label>Har post oxirida chiqadigan chaqiriq<textarea value={plan.contentCta} onChange={(event) => setPlan((current) => ({ ...current, contentCta: event.target.value }))} maxLength={500} placeholder="Masalan: Savollaringiz bo‘lsa, izohlarda yozing yoki qabulga yoziling." /></label><small>{plan.contentCta.length} / 500 belgi</small></section><section className={styles.settingsSection}><h2>Ishonchli manbalar</h2><div className={styles.addRow}><input value={source} onChange={(event) => setSource(event.target.value)} onKeyDown={(event) => addOnEnter(event, addSource)} placeholder="https://www.who.int/..." inputMode="url" /><button type="button" className={styles.outlineButton} onClick={addSource}>Qo‘shish</button></div><div className={styles.sourceList}>{plan.sourceUrls.length ? plan.sourceUrls.map((item) => <div key={item}><a href={item} target="_blank" rel="noreferrer">{item}</a><button type="button" aria-label={`${item} manbasini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, sourceUrls: current.sourceUrls.filter((value) => value !== item) }))}>O‘chirish</button></div>) : <span className={styles.emptyInline}>Hali manba kiritilmagan.</span>}</div><small>Faqat to‘liq <b>https://</b> havolalar qabul qilinadi. Saqlashda format tekshiriladi.</small></section>{message && <p className={message.includes("saqlandi") ? styles.saveSuccess : styles.saveError}>{message}</p>}<button className={styles.primaryButton} disabled={saving}>{saving ? "Saqlanmoqda…" : "Kontent sozlamalarini saqlash"}</button></form></section>;
}
