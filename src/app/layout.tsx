import type { Metadata } from "next";
import "./globals.css";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { LoginScreen } from "./login-screen";

export const metadata: Metadata = {
  title: "Shifokor | Boshqaruv paneli",
  description: "Telegram kanali uchun xavfsiz avtomatik kontent boshqaruvi",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authenticated = await isAdminAuthenticated();
  return (
    <html lang="uz">
      <body>{authenticated ? children : <LoginScreen />}</body>
    </html>
  );
}
