"use client";

import { FormEvent, useState } from "react";
import styles from "./page.module.css";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    setLoading(false);
    if (!response.ok) { setMessage("Username yoki password noto‘g‘ri."); return; }
    window.location.reload();
  }

  return <main className={styles.loginPage}><form className={styles.loginCard} onSubmit={login}><div className={styles.loginMark}>S</div><h1>Shifokor Admin</h1><p>Davom etish uchun admin ma’lumotlari bilan kiring.</p><label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <p className={styles.saveError}>{message}</p>}<button className={styles.primaryButton} disabled={loading}>{loading ? "Tekshirilmoqda…" : "Kirish"}</button></form></main>;
}
