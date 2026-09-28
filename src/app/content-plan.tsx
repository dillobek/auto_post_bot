"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type ScheduleItem = { time: string; enabled: boolean };
type ContentPlan = { contentTopics: string[]; contentCta: string; sourceUrls: string[]; postSchedule: ScheduleItem[] };

const emptyPlan: ContentPlan = { contentTopics: [], contentCta: "", sourceUrls: [], postSchedule: [] };

export function ContentPlanSetup() {
  const [plan, setPlan] = useState<ContentPlan>(emptyPlan);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/telegram-settings")
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((value: ContentPlan) => setPlan({ contentTopics: value.contentTopics ?? [], contentCta: value.contentCta ?? "", sourceUrls: value.sourceUrls ?? [], postSchedule: value.postSchedule ?? [] }))
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

  function addScheduleTime() {
    if (plan.postSchedule.some((item) => item.time === scheduleTime)) return;
    setPlan((current) => ({ ...current, postSchedule: [...current.postSchedule, { time: scheduleTime, enabled: true }].sort((left, right) => left.time.localeCompare(right.time)) }));
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
    setPlan({ contentTopics: result.contentTopics ?? [], contentCta: result.contentCta ?? "", sourceUrls: result.sourceUrls ?? [], postSchedule: result.postSchedule ?? [] });
    setMessage("Mavzular, vaqtlar, CTA va manbalar saqlandi.");
  }

  return <section className={styles.settingsPage}>
    <div className={styles.settingsIntro}>
      <div><h1>Kontent rejasi</h1><p>Mavzular, post oxiridagi chaqiriq, manbalar va e’lon vaqtlarini shu yerda boshqaring.</p></div>
      <span className={plan.contentTopics.length || plan.contentCta || plan.sourceUrls.length ? styles.connectedBadge : styles.needsSetup}>{plan.contentTopics.length} mavzu · {plan.postSchedule.filter((item) => item.enabled).length} faol vaqt</span>
    </div>
    <form className={styles.settingsForm} onSubmit={save}>
      <section className={styles.settingsSection}>
        <h2>Mavzular</h2>
        <div className={styles.addRow}><input value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => addOnEnter(event, addTopic)} placeholder="Masalan: bolalarda mavsumiy allergiya" maxLength={120} /><button type="button" className={styles.outlineButton} onClick={addTopic}>Qo‘shish</button></div>
        <div className={styles.tagList}>{plan.contentTopics.length ? plan.contentTopics.map((item) => <span className={styles.tag} key={item}>{item}<button type="button" aria-label={`${item} mavzusini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, contentTopics: current.contentTopics.filter((value) => value !== item) }))}>×</button></span>) : <span className={styles.emptyInline}>Hali mavzu kiritilmagan.</span>}</div>
      </section>
      <section className={styles.settingsSection}>
        <h2>Post jadvali</h2>
        <p className={styles.scheduleCaption}>Vaqtlar Toshkent vaqti (UTC+5) bo‘yicha ishlaydi. Faol vaqt kelganda bot bitta post yuboradi.</p>
        <div className={styles.addRow}><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /><button type="button" className={styles.outlineButton} onClick={addScheduleTime}>Vaqt qo‘shish</button></div>
        <div className={styles.scheduleList}>{plan.postSchedule.length ? plan.postSchedule.map((item) => <div key={item.time}><input aria-label="Post vaqti" type="time" value={item.time} onChange={(event) => setPlan((current) => ({ ...current, postSchedule: current.postSchedule.map((value) => value.time === item.time ? { ...value, time: event.target.value } : value) }))} /><label className={styles.scheduleToggle}><input type="checkbox" checked={item.enabled} onChange={(event) => setPlan((current) => ({ ...current, postSchedule: current.postSchedule.map((value) => value.time === item.time ? { ...value, enabled: event.target.checked } : value) }))} />Faol</label><button type="button" onClick={() => setPlan((current) => ({ ...current, postSchedule: current.postSchedule.filter((value) => value.time !== item.time) }))}>O‘chirish</button></div>) : <span className={styles.emptyInline}>Hali e’lon vaqti qo‘shilmagan — bot post yubormaydi.</span>}</div>
      </section>
      <section className={styles.settingsSection}>
        <h2>Post CTA</h2>
        <label>Har post oxirida chiqadigan chaqiriq<textarea value={plan.contentCta} onChange={(event) => setPlan((current) => ({ ...current, contentCta: event.target.value }))} maxLength={500} placeholder="Masalan: Savollaringiz bo‘lsa, izohlarda yozing yoki qabulga yoziling." /></label>
        <small>{plan.contentCta.length} / 500 belgi</small>
      </section>
      <section className={styles.settingsSection}>
        <h2>Ishonchli manbalar</h2>
        <div className={styles.addRow}><input value={source} onChange={(event) => setSource(event.target.value)} onKeyDown={(event) => addOnEnter(event, addSource)} placeholder="https://www.who.int/..." inputMode="url" /><button type="button" className={styles.outlineButton} onClick={addSource}>Qo‘shish</button></div>
        <div className={styles.sourceList}>{plan.sourceUrls.length ? plan.sourceUrls.map((item) => <div key={item}><a href={item} target="_blank" rel="noreferrer">{item}</a><button type="button" aria-label={`${item} manbasini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, sourceUrls: current.sourceUrls.filter((value) => value !== item) }))}>O‘chirish</button></div>) : <span className={styles.emptyInline}>Hali manba kiritilmagan.</span>}</div>
        <small>Faqat to‘liq <b>https://</b> havolalar qabul qilinadi. Saqlashda format tekshiriladi.</small>
      </section>
      {message && <p className={message.includes("saqlandi") ? styles.saveSuccess : styles.saveError}>{message}</p>}
      <button className={styles.primaryButton} disabled={saving}>{saving ? "Saqlanmoqda…" : "Kontent sozlamalarini saqlash"}</button>
    </form>
  </section>;
}
