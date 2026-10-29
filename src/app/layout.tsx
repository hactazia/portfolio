import type { Metadata, Viewport } from "next";
import { Funnel_Display, Inter_Tight, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import "@/styles/main.scss";

const display = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

/** Used by the wordmark next to the logo mark. */
const funnel = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Hactazia — Studio",
    template: "%s · Hactazia",
  },
  description:
    "Web development end to end — API, interface and deployment — plus Unity tooling and VR scenes.",
  icons: {
    icon: [
      {
        url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`,
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#07070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${funnel.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
