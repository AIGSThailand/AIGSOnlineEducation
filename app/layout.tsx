import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  variable: "--font-aigs-sans",
  display: "swap",
});

const display = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-aigs-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIGS Online Education Platform",
  description:
    "Explore online courses from AIGS. Build your knowledge of gems and jewelry with structured lessons and track your learning progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
