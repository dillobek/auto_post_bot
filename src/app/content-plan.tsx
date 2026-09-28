"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type ScheduleItem = { time: string; enabled: boolean };
type ScheduleKind = "post" | "poll" | "info";
type PostSchedules = Record<ScheduleKind, ScheduleItem[]>;
type ContentPlan = {
  contentTopics: string[];
  contentCta: string;
  ctaAdminUsername: string;
  websiteUrl: string;
  phoneNumber: string;
  additionalPhoneNumber: string;
  instagramHandle: string;
  sourceUrls: string[];
  postSchedules: PostSchedules;
};

const emptySchedules: PostSchedules = { post: [], poll: [], info: [] };
const emptyPlan: ContentPlan = { contentTopics: [], contentCta: "", ctaAdminUsername: "", websiteUrl: "", phoneNumber: "", additionalPhoneNumber: "", instagramHandle: "", sourceUrls: [], postSchedules: emptySchedules };
const scheduleCopy = (values?: Partial<PostSchedules>): PostSchedules => ({ post: values?.post ?? [], poll: values?.poll ?? [], info: values?.info ?? [] });

function ScheduleSection({ kind, title, description, items, newTime, onNewTimeChange, onChange }: { kind: ScheduleKind; title: string; description: string; items: ScheduleItem[]; newTime: string; onNewTimeChange: (value: string) => void; onChange: (next: ScheduleItem[]) => void }) {
  function addTime() {
    if (!items.some((item) => item.time === newTime)) onChange([...items, { time: newTime, enabled: true }].sort((a, b) => a.time.localeCompare(b.time)));
  }
  return <section className={styles.settingsSection}>
    <h2>{title}</h2><p className={styles.scheduleCaption}>{description} Vaqtlar Toshkent vaqti (UTC+5) bo‘yicha ishlaydi.</p>
    <div className={styles.addRow}><input type="time" value={newTime} onChange={(event) => onNewTimeChange(event.target.value)} /><button type="button" className={styles.outlineButton} onClick={addTime}>Vaqt qo‘shish</button></div>
    <div className={styles.scheduleList}>{items.length ? items.map((item, index) => <div key={`${kind}-${item.time}-${index}`}><input aria-label={`${title} vaqti`} type="time" value={item.time} onChange={(event) => onChange(items.map((value, valueIndex) => valueIndex === index ? { ...value, time: event.target.value } : value))} /><label className={styles.scheduleToggle}><input type="checkbox" checked={item.enabled} onChange={(event) => onChange(items.map((value, valueIndex) => valueIndex === index ? { ...value, enabled: event.target.checked } : value))} />Faol</label><button type="button" onClick={() => onChange(items.filter((_, valueIndex) => valueIndex !== index))}>O‘chirish</button></div>) : <span className={styles.emptyInline}>Hali vaqt qo‘shilmagan — bu oqim yuborilmaydi.</span>}</div>
  </section>;
}

export function ContentPlanSetup() {
  const [plan, setPlan] = useState<ContentPlan>(emptyPlan);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [times, setTimes] = useState<Record<ScheduleKind, string>>({ post: "09:00", poll: "13:00", info: "18:00" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function normalize(value: Partial<ContentPlan> & { postSchedule?: ScheduleItem[] }): ContentPlan {
    return { ...emptyPlan, ...value, contentTopics: value.contentTopics ?? [], contentCta: value.contentCta ?? "", ctaAdminUsername: value.ctaAdminUsername ?? "", websiteUrl: value.websiteUrl ?? "", phoneNumber: value.phoneNumber ?? "", additionalPhoneNumber: value.additionalPhoneNumber ?? "", instagramHandle: value.instagramHandle ?? "", sourceUrls: value.sourceUrls ?? [], postSchedules: scheduleCopy(value.postSchedules ?? { post: value.postSchedule ?? [] }) };
  }

  useEffect(() => {
    fetch("/api/telegram-settings").then(async (response) => response.ok ? response.json() : Promise.reject()).then((value) => setPlan(normalize(value))).catch(() => setMessage("Kontent sozlamalarini yuklab bo‘lmadi."));
  }, []);

  function addTopic() {
    const values = topic.split(",").map((item) => item.trim()).filter(Boolean);
    if (!values.length) return;
    setPlan((current) => ({ ...current, contentTopics: [...current.contentTopics, ...values.filter((value) => !current.contentTopics.some((saved) => saved.localeCompare(value, undefined, { sensitivity: "accent" }) === 0))] }));
    setTopic("");
  }
  function addSource() { const value = source.trim(); if (!value || plan.sourceUrls.includes(value)) return; setPlan((current) => ({ ...current, sourceUrls: [...current.sourceUrls, value] })); setSource(""); }
  function addOnEnter(event: KeyboardEvent<HTMLInputElement>, add: () => void) { if (event.key === "Enter") { event.preventDefault(); add(); } }
  function changeSchedule(kind: ScheduleKind, values: ScheduleItem[]) { setPlan((current) => ({ ...current, postSchedules: { ...current.postSchedules, [kind]: values } })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/telegram-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
    const result = await response.json() as Partial<ContentPlan> & { error?: string };
    setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "Kontent sozlamalarini saqlab bo‘lmadi."); return; }
    setPlan(normalize(result)); setMessage("Kontent sozlamalari saqlandi.");
  }

  const activeCount = Object.values(plan.postSchedules).flat().filter((item) => item.enabled).length;
  return <section className={styles.settingsPage}>
    <div className={styles.settingsIntro}><div><h1>Kontent rejasi</h1><p>Uch oqim, mavzular va ixtiyoriy CTA kontaktlarini mustaqil boshqaring.</p></div><span className={plan.contentTopics.length || activeCount ? styles.connectedBadge : styles.needsSetup}>{plan.contentTopics.length} mavzu · {activeCount} faol vaqt</span></div>
    <form className={styles.settingsForm} onSubmit={save}>
      <section className={styles.settingsSection}>
        <h2>Mavzular</h2><p className={styles.scheduleCaption}>Istalgan sohani yozing. Bir nechta mavzuni vergul bilan kiriting: masalan, Kardiologiya, Pulmonologiya.</p>
        <div className={styles.addRow}><input value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => addOnEnter(event, addTopic)} placeholder="Masalan: Kardiologiya, Pulmonologiya" maxLength={120} /><button type="button" className={styles.outlineButton} onClick={addTopic}>Qo‘shish</button></div>
        <div className={styles.tagList}>{plan.contentTopics.length ? plan.contentTopics.map((item) => <span className={styles.tag} key={item}>{item}<button type="button" aria-label={`${item} mavzusini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, contentTopics: current.contentTopics.filter((value) => value !== item) }))}>×</button></span>) : <span className={styles.emptyInline}>Hali mavzu kiritilmagan.</span>}</div>
      </section>
      <ScheduleSection kind="post" title="Post vaqtlari" description="Ta’limiy postlar shu vaqtlarda yuboriladi." items={plan.postSchedules.post} newTime={times.post} onNewTimeChange={(value) => setTimes((current) => ({ ...current, post: value }))} onChange={(values) => changeSchedule("post", values)} />
      <ScheduleSection kind="poll" title="So‘rovnoma vaqtlari" description="Telegramdagi oproslar shu vaqtlarda yuboriladi." items={plan.postSchedules.poll} newTime={times.poll} onNewTimeChange={(value) => setTimes((current) => ({ ...current, poll: value }))} onChange={(values) => changeSchedule("poll", values)} />
      <ScheduleSection kind="info" title="Ma’lumot vaqtlari" description="Qisqa foydali ma’lumotlar shu vaqtlarda yuboriladi." items={plan.postSchedules.info} newTime={times.info} onNewTimeChange={(value) => setTimes((current) => ({ ...current, info: value }))} onChange={(values) => changeSchedule("info", values)} />
      <section className={styles.settingsSection}>
        <h2>CTA va kontaktlar <small>(ixtiyoriy)</small></h2><p className={styles.scheduleCaption}>Bo‘sh qoldirilgan maydon postga qo‘shilmaydi.</p>
        <label>Qo‘shimcha chaqiriq<textarea value={plan.contentCta} onChange={(event) => setPlan((current) => ({ ...current, contentCta: event.target.value }))} maxLength={500} placeholder="Masalan: Savollaringiz bo‘lsa, izohlarda yozing." /></label>
        <div className={styles.contactGrid}><label>Admin username<input value={plan.ctaAdminUsername} onChange={(event) => setPlan((current) => ({ ...current, ctaAdminUsername: event.target.value }))} placeholder="@admin" /></label><label>Website<input value={plan.websiteUrl} onChange={(event) => setPlan((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://example.uz" inputMode="url" /></label><label>Telefon raqam<input value={plan.phoneNumber} onChange={(event) => setPlan((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="+998 90 123 45 67" inputMode="tel" /></label><label>Qo‘shimcha raqam<input value={plan.additionalPhoneNumber} onChange={(event) => setPlan((current) => ({ ...current, additionalPhoneNumber: event.target.value }))} placeholder="+998 90 765 43 21" inputMode="tel" /></label><label>Instagram<input value={plan.instagramHandle} onChange={(event) => setPlan((current) => ({ ...current, instagramHandle: event.target.value }))} placeholder="@clinic" /></label></div>
      </section>
      <section className={styles.settingsSection}>
        <h2>Qo‘shimcha manbalar <small>(ixtiyoriy)</small></h2><p className={styles.scheduleCaption}>Kiritilmasa ham AI rasmiy tibbiy saytlarni qidirib, manbali post tayyorlaydi.</p>
        <div className={styles.addRow}><input value={source} onChange={(event) => setSource(event.target.value)} onKeyDown={(event) => addOnEnter(event, addSource)} placeholder="https://www.who.int/..." inputMode="url" /><button type="button" className={styles.outlineButton} onClick={addSource}>Qo‘shish</button></div>
        <div className={styles.sourceList}>{plan.sourceUrls.length ? plan.sourceUrls.map((item) => <div key={item}><a href={item} target="_blank" rel="noreferrer">{item}</a><button type="button" aria-label={`${item} manbasini o‘chirish`} onClick={() => setPlan((current) => ({ ...current, sourceUrls: current.sourceUrls.filter((value) => value !== item) }))}>O‘chirish</button></div>) : <span className={styles.emptyInline}>Qo‘shimcha manba yo‘q — rasmiy saytlar avtomatik qidiriladi.</span>}</div>
      </section>
      {message && <p className={message.includes("saqlandi") ? styles.saveSuccess : styles.saveError}>{message}</p>}<button className={styles.primaryButton} disabled={saving}>{saving ? "Saqlanmoqda…" : "Kontent sozlamalarini saqlash"}</button>
    </form>
  </section>;
}
