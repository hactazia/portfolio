import type { Metadata } from "next";
import { Funnel_Display } from "next/font/google";
import "./globals.css";

const funnelDisplay = Funnel_Display({
  variable: "--font-funnel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Votre nom — Portfolio",
  description: "Portfolio de votre nom, développeur full-stack.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={funnelDisplay.variable}>
      <body>{children}</body>
    </html>
  );
}
