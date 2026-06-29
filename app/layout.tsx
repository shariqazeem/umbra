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
  title: "Umbra — Private Finance for Stellar",
  description: "Consumer privacy layer for Stellar commerce.",
  applicationName: "Umbra",
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
