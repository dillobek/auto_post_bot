"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { TelegramSetup } from "./telegram-setup";

type IconName = "home" | "calendar" | "settings" | "chat" | "help" | "logout" | "bell" | "pause" | "play" | "telegram" | "users" | "image" | "poll" | "file" | "clock" | "check" | "chevron" | "bot" | "arrow";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 21v-7h6v7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.7 2.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.2h-3.82v-.2a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.7-2.7.06-.06A1.7 1.7 0 0 0 5 15a1.7 1.7 0 0 0-1.56-1.04h-.2v-3.82h.2A1.7 1.7 0 0 0 5 9.1a1.7 1.7 0 0 0-.34-1.88L4.6 7.16l2.7-2.7.06.06A1.7 1.7 0 0 0 9.24 4.86 1.7 1.7 0 0 0 10.28 3.3v-.2h3.82v.2a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.7 2.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.2v3.82h-.2A1.7 1.7 0 0 0 19.4 15Z" /></>,
    chat: <><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.7 9.7 0 0 1-3.6-.7L3 21l1.8-4.6A8.2 8.2 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5a8.8 8.8 0 0 1 9 8Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.25 2.2c-.98.68-1.75 1.17-1.75 2.8" /><path d="M12 17h.01" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    telegram: <path d="m21 4-3 16-5.3-5.3-3.1 3.1.7-4.6L4 10l17-6ZM10.5 13.3 18.3 6 7 10.3l3.5 3Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    poll: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    bot: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const steps = [
  { time: "09:00", title: "Rasmli post", detail: "Bolalarda mavsumiy allergiya", icon: "image" as const, status: "Yuborildi", done: true },
  { time: "13:00", title: "So‘rovnoma", detail: "Allergiya alomatlari haqida yozaymi?", icon: "poll" as const, status: "Navbatda", done: false },
  { time: "18:00", title: "Foydali post", detail: "Allergiyani yengillashtirish bo‘yicha 5 maslahat", icon: "file" as const, status: "Navbatda", done: false },
];

function Navigation({ active, onNavigate }: { active: string; onNavigate: (item: string) => void }) {
  const nav = [
    ["Bosh sahifa", "home"], ["Kontent rejasi", "calendar"], ["Sozlamalar", "settings"], ["Guruh savollari", "chat"],
  ] as const;
  return <aside className={styles.sidebar}>
    <div className={styles.brand}><div className={styles.brandMark}><span /><span /><span /></div><div><strong>Shifokor</strong><small>Bilim ulashadi. Sog‘lom jamiyat.</small></div></div>
    <nav className={styles.navigation}>{nav.map(([label, icon]) => <button key={label} className={active === label ? styles.navActive : styles.navItem} onClick={() => onNavigate(label)}><Icon name={icon} size={21} /><span>{label}</span></button>)}</nav>
    <div className={styles.sidebarBottom}><button className={styles.navItem}><Icon name="help" size={21} /><span>Yordam markazi</span></button><button className={styles.navItem}><Icon name="logout" size={21} /><span>Tizimdan chiqish</span></button></div>
  </aside>;
}

function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(1);
  const titles = ["Botni ulash", "Mutaxassislik", "Kontent grafigi", "Profil va CTA", "Avtomatlashtirish"];
  return <main className={styles.onboarding}><section className={styles.onboardingCard}><div className={styles.brand}><div className={styles.brandMark}><span /><span /><span /></div><strong>Shifokor</strong></div><p className={styles.stepLabel}>{step} / 5 qadam</p><div className={styles.progressTrack}><i style={{ width: `${step * 20}%` }} /></div><h1>{titles[step - 1]}</h1>{step === 1 && <><p>Telegram botni kanal va muhokama guruhiga admin qilib qo‘shing. Keyin uning huquqlarini tekshiramiz.</p><div className={styles.connectBox}><Icon name="telegram" size={28} /><div><strong>Shifokor Bot</strong><span>@shifokor_autopost_bot</span></div><button className={styles.outlineButton}>Nusxalash</button></div></>}{step === 2 && <><p>Sizning faoliyat yo‘nalishlaringizni tanlang. Kontent shunga moslashadi.</p><div className={styles.choiceGrid}>{["Pediatriya", "Allergologiya", "Pulmonologiya", "Kardiologiya"].map((item, i) => <button className={i < 2 ? styles.choiceSelected : styles.choice} key={item}>{item}{i < 2 && <Icon name="check" size={16} />}</button>)}</div></>}{step === 3 && <><p>Bir kunda uchta foydali bosqich. Vaqt Toshkent bo‘yicha hisoblanadi.</p><div className={styles.scheduleForm}>{steps.map((item) => <label key={item.title}><span>{item.title}</span><input type="time" defaultValue={item.time} /></label>)}</div></>}{step === 4 && <><p>Postlar pastida ko‘rinadigan kontakt va yozilish ma’lumotlarini kiriting.</p><div className={styles.formFields}><label>Ism va familiya<input defaultValue="Dilnoza Karimova" /></label><label>Yozilish havolasi<input placeholder="https://..." /></label></div></>}{step === 5 && <><p>Bot xavfsizlik tekshiruvlaridan keyin postlarni o‘zi tayyorlaydi va e’lon qiladi. Istalgan vaqtda pauza qilishingiz mumkin.</p><div className={styles.successBox}><span className={styles.successIcon}><Icon name="check" /></span><div><strong>Hammasi tayyor</strong><p>Oylik AI limiti: 50 USD. Siz keyin o‘zgartira olasiz.</p></div></div></>}<div className={styles.onboardingActions}><button className={styles.ghostButton} onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>Orqaga</button><button className={styles.primaryButton} onClick={() => step === 5 ? onFinish() : setStep((current) => current + 1)}>{step === 5 ? "Bosh sahifaga o‘tish" : "Davom etish"}<Icon name="arrow" size={18} /></button></div></section></main>;
}

export default function Home() {
  const [active, setActive] = useState("Bosh sahifa");
  const [running, setRunning] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  if (showOnboarding) return <Onboarding onFinish={() => setShowOnboarding(false)} />;
  if (active === "Sozlamalar") return <main className={styles.app}><Navigation active={active} onNavigate={setActive} /><section className={styles.main}><header className={styles.topbar}><div className={styles.mobileBrand}>Shifokor</div><div className={styles.userArea}><div className={styles.avatar}>D</div><div className={styles.userName}><strong>Dilnoza Karimova</strong><span>Shifokor</span></div></div></header><div className={styles.content}><TelegramSetup /></div></section></main>;
  return <main className={styles.app}><Navigation active={active} onNavigate={setActive} /><section className={styles.main}><header className={styles.topbar}><div className={styles.mobileBrand}>Shifokor</div><div className={styles.userArea}><button className={styles.iconButton} aria-label="Bildirishnomalar"><Icon name="bell" /></button><div className={styles.avatar}>D</div><div className={styles.userName}><strong>Dilnoza Karimova</strong><span>Shifokor</span></div></div></header><div className={styles.content}>{active !== "Bosh sahifa" ? <section className={styles.emptyState}><Icon name={active === "Kontent rejasi" ? "calendar" : active === "Sozlamalar" ? "settings" : "chat"} size={38} /><h1>{active}</h1><p>Bu bo‘limning API bilan bog‘lanadigan ekrani keyingi qadamda tayyorlanadi.</p><button className={styles.primaryButton} onClick={() => setActive("Bosh sahifa")}>Bosh sahifaga qaytish</button></section> : <><section className={styles.intro}><div><h1>Assalomu alaykum, Dilnoza!</h1><p>Bugun kontentingiz rejaga muvofiq xavfsiz tarqatiladi.</p></div><div className={styles.introActions}><button className={running ? styles.pauseButton : styles.resumeButton} onClick={() => setRunning(!running)}><Icon name={running ? "pause" : "play"} size={20} />{running ? "Botni pauza qilish" : "Botni davom ettirish"}</button><button className={styles.outlineButton} onClick={() => setShowOnboarding(true)}>Sozlashni qayta ko‘rish</button></div></section><section className={styles.statusGrid}><article className={styles.statusCard}><div className={running ? styles.statusDot : styles.statusDotPaused} /><div><h2>{running ? "Bot ishlayapti" : "Bot pauzada"}</h2><p>{running ? "Kontentlar reja bo‘yicha avtomatik yuborilmoqda." : "Yangi postlar yuborilmaydi. Istalgan payt davom ettiring."}</p></div><div className={styles.botIdentity}><span className={styles.botIcon}><Icon name="bot" /></span><div><strong>Shifokor Bot</strong><small>@shifokor_autopost_bot</small></div></div></article><article className={styles.connectedCard}><div className={styles.cardHeading}><h2>Ulangan kanallar</h2><button>Hammasi <Icon name="arrow" size={16} /></button></div><div className={styles.channelList}><div><span className={styles.telegramIcon}><Icon name="telegram" /></span><p><strong>Doktor Dilnoza</strong><small>Kanal · 12 480 obunachi</small></p></div><div><span className={styles.groupIcon}><Icon name="users" /></span><p><strong>Sog‘lom oila</strong><small>Guruh · 3 215 a’zo</small></p></div></div></article></section><section className={styles.dashboardGrid}><article className={styles.campaign}><div className={styles.cardHeading}><h2>Bugungi kontent zanjiri</h2><button>To‘liq reja <Icon name="arrow" size={16} /></button></div><div className={styles.timeline}>{steps.map((item, index) => <div className={styles.timelineItem} key={item.title}><div className={styles.timelineTop}><span className={item.done ? styles.stepDone : styles.stepNumber}>{index + 1}</span><strong>{item.time}</strong></div><article className={styles.contentStep}><span className={styles.stepIcon}><Icon name={item.icon} /></span><h3>{item.title}</h3><p>{item.detail}</p><small className={item.done ? styles.doneStatus : styles.waitingStatus}><Icon name={item.done ? "check" : "clock"} size={15} />{item.status} · {item.time}</small></article></div>)}</div></article><article className={styles.spendCard}><div className={styles.cardHeading}><h2>AI sarfi <span>(oylik)</span></h2><button>1–30 sentabr</button></div><strong className={styles.spendValue}>18.40 <small>/ 50 USD</small></strong><div className={styles.spendMeter}><i /></div><p className={styles.limitNote}>Limitning 63% qismi qolgan. Xavfsiz hududdasiz.</p></article><article className={styles.questions}><div className={styles.cardHeading}><h2>Muhim savollar</h2><button>Hammasi <Icon name="arrow" size={16} /></button></div>{[["Muhim", "Bolada isitma 38.5, qachon shifokorga murojaat qilish kerak?", "Sog‘lom oila · 14:27"], ["O‘rtacha", "Homiladorlikda paratsetamol ichish mumkinmi?", "Sog‘lom oila · 11:03"]].map(([level, question, meta]) => <button className={styles.question} key={question}><span className={level === "Muhim" ? styles.redDot : styles.yellowDot} /><span><strong>{question}</strong><small>{meta}</small></span><em className={level === "Muhim" ? styles.urgent : styles.medium}>{level}</em><Icon name="chevron" size={18} /></button>)}</article><article className={styles.today}><div className={styles.cardHeading}><h2>Bugungi jadval</h2></div>{steps.map((step) => <div className={styles.scheduleRow} key={step.title}><span className={step.done ? styles.rowDone : styles.rowWaiting} /><strong>{step.time}</strong><span>{step.title}</span><Icon name={step.done ? "check" : "clock"} size={18} /></div>)}</article></section></>}</div></section></main>;
}
