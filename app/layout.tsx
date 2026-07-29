import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";

import "./globals.css";

// The same two families the site loads, for the same reasons: Syne carries display type,
// DM Sans carries everything you actually read.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "voidix — control",
  description: "Content control panel for the voidix site.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} h-full antialiased`}>
      {/*
        suppressHydrationWarning is scoped to <body> and covers exactly one real problem:
        browser extensions inject attributes here before React hydrates (ColorZilla adds
        `cz-shortcut-listen`, password managers and Grammarly add their own), and React counts
        that as a mismatch it can't reconcile. It suppresses the warning for THIS element's
        attributes only — children still hydrate normally and a genuine markup mismatch inside
        the app is still reported.
      */}
      <body
        suppressHydrationWarning
        className="font-sans min-h-full flex flex-col bg-bg text-fg"
      >
        {children}
      </body>
    </html>
  );
}
