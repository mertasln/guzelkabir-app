import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { CurrencyProvider } from "@/lib/currency";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GüzelKabir — Sevdiklerinizin kabri, vefa ile bakımlı",
  description:
    "Uzaktan, şeffaf ve itinalı kabir bakımı. Onaylı yerel ustalar, GPS ve zaman damgalı önce/sonra fotoğraflarıyla. İstanbul pilotu.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
