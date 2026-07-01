import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";

import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Heavy condensed display face for the brutalist/infra headlines.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Umbra — Private money on Stellar",
  description:
    "Hold a private balance, send with the amount hidden on-chain, and disclose only when you choose — every move verified by a zero-knowledge proof on Stellar.",
  applicationName: "Umbra",
  openGraph: {
    title: "Umbra — Private money on Stellar",
    description:
      "Shield, send with the amount hidden on-chain, and cash out unlinkably. Our own zero-knowledge circuits, verified by a Stellar smart contract.",
    images: [{ url: "/art/og.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umbra — Private money on Stellar",
    description:
      "Private payments on Stellar with the amount hidden on-chain. Our own ZK, verified on-chain.",
    images: ["/art/og.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
