import { useApi } from '@/hooks/use-api';
import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();
  const { current } = useApi();

  const links = [
    { href: '#about', label: 'À propos' },
    { href: '#services', label: 'Services' },
    { href: '#projects', label: 'Projets' },
    { href: '#contact', label: 'Contact' },
  ];

  return (
    <footer className="relative py-4 flex flex-col overflow-hidden border-t rounded-t-[2em] border shadow-md shadow-[0_-4px_6px_-1px_#0000001a]">
      <div className="container mx-auto max-w-6xl px-4 flex flex-col items-center justify-center gap-4 text-sm text-muted-foreground">
        <div>
          <h1 className='text-brand'>
            <Link href={current.server.url}>
              {new URL(current.server.url).hostname}
            </Link>
          </h1>
        </div>
        <div className="flex flex-grid md:flex-grid items-center justify-center gap-4">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
