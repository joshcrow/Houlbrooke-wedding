import type { Metadata } from "next";
import { Cormorant_Garamond, Great_Vibes, Inter } from "next/font/google";
import { COUPLE } from "@/lib/config";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-serif",
});
const script = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: `${COUPLE.names} ${COUPLE.lastName} — Share Your Photos`,
  description: `Add your photos & videos from ${COUPLE.names}'s wedding.`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${serif.variable} ${script.variable} ${sans.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
