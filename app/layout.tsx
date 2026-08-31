import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIGS Online Education Platform",
  description: "Modern Online Education Management System built with Next.js, Supabase, and Stripe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
