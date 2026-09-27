import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shifokor | Boshqaruv paneli",
  description: "Telegram kanali uchun xavfsiz avtomatik kontent boshqaruvi",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
