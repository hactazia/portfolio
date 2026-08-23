import type { Metadata } from 'next';
import { Funnel_Display } from 'next/font/google';
import './globals.css';

const funnelDisplay = Funnel_Display({
  variable: '--font-funnel',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Votre nom — Portfolio',
  description: 'Portfolio de votre nom, développeur full-stack.',
};

// Next.js layout typings fallback
type LayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html lang="fr" className={funnelDisplay.variable}>
      <body className="min-h-screen bg-background font-sans flex flex-col antialiased">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
