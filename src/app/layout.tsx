import type { Metadata } from "next";
import { Instrument_Sans, Lexend, Oswald } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const lexend = Lexend({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-lexend",
  weight: "200",
});

const oswald = Oswald({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: "300",
});

export const metadata: Metadata = {
  title: "Arakkis",
  description: "A foundation for lightweight fitness event operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${lexend.variable} ${oswald.variable}`}>
      <body>{children}</body>
    </html>
  );
}
