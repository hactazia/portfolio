'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { icons } from '@/components/icons';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';

export function NavBar() {
  const { current } = useApi();

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '/', label: 'À propos' },
    { href: '#services', label: 'Services' },
    { href: '/projects', label: 'Projets' },
    { href: '#contact', label: 'Contact' },
  ];

  const MailIcon = icons.mail;

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-line py-5' : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto max-w-6xl px-4 flex items-center justify-between">
        <Link
          href={current.server.url}
          className="flex items-center gap-2 font-bold text-lg tracking-tight group"
        >
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black group-hover:rotate-12 transition-transform">
            H
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="#contact">
            {icons.mail({ size: 16 })}
            Contact
          </Link>
        </Button>
      </div>
    </nav>
  );
}
