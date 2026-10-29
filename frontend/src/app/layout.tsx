import type { Metadata } from 'next';
import { Funnel_Display, DM_Sans } from 'next/font/google';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';

const funnelDisplay = Funnel_Display({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Hactazia — Portfolio',
  description: 'Portfolio de Hactazia, développeur VR indépendant.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${funnelDisplay.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans flex flex-col antialiased">
        <TooltipProvider>
          <main className="flex-1 flex flex-col">{children}</main>
        </TooltipProvider>
      </body>
    </html>
  );
}
