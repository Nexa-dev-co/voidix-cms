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
      <body className="font-sans min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
