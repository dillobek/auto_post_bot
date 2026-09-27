import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shifokor | Boshqaruv paneli",
  description: "Telegram kanali uchun xavfsiz avtomatik kontent boshqaruvi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
