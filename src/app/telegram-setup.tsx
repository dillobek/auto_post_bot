"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type TelegramSettings = { hasBotToken: boolean; channelId: string; groupId: string; updatedAt: string | null };

export function TelegramSetup() {
  const [settings, setSettings] = useState<TelegramSettings>({ hasBotToken: false, channelId: "", groupId: "", updatedAt: null });
  const [botToken, setBotToken] = useState(""); const [channelId, setChannelId] = useState(""); const [groupId, setGroupId] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/telegram-settings").then(async (response) => response.ok ? response.json() : Promise.reject()).then((value: TelegramSettings) => { setSettings(value); setChannelId(value.channelId); setGroupId(value.groupId); }).catch(() => setMessage("Server shifrlash kaliti hali sozlanmagan.")); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/telegram-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken: botToken || undefined, channelId, groupId }) });
    const result = await response.json() as TelegramSettings & { error?: string }; setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "Sozlamani saqlab bo‘lmadi."); return; }
    setSettings(result); setBotToken(""); setMessage("Telegram sozlamalari shifrlangan holda saqlandi.");
  }
  return <section className={styles.settingsPage}><div className={styles.settingsIntro}><div><h1>Telegram ulanishi</h1><p>Bot tokeni faqat serverda shifrlangan holda saqlanadi. Uni keyin qayta ko‘rib bo‘lmaydi.</p></div><span className={settings.hasBotToken ? styles.connectedBadge : styles.needsSetup}>{settings.hasBotToken ? "Bot tokeni ulangan" : "Ulanish kutilmoqda"}</span></div><form className={styles.settingsForm} onSubmit={save}><label>Bot tokeni<input type="password" autoComplete="new-password" value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder={settings.hasBotToken ? "Yangi token berilmagan" : "123456:AA..."} /></label><small>Tokenni @BotFather’dan oling. Token hech qachon sahifaga qaytarilmaydi.</small><div className={styles.formFields}><label>Kanal ID yoki username<input value={channelId} onChange={(event) => setChannelId(event.target.value)} placeholder="-1001234567890 yoki @kanal_nomi" /></label><label>Muhokama guruhi ID yoki username<input value={groupId} onChange={(event) => setGroupId(event.target.value)} placeholder="-1001234567890 yoki @guruh_nomi" /></label></div><div className={styles.settingsHint}>Botni kanal va guruhga admin qiling. So‘ng botning <b>/status</b> buyrug‘i huquqlarni tekshiradi.</div>{message && <p className={message.includes("saqlandi") ? styles.saveSuccess : styles.saveError}>{message}</p>}<button className={styles.primaryButton} disabled={saving}>{saving ? "Saqlanmoqda…" : "Telegram sozlamalarini saqlash"}</button></form></section>;
}
