'use client';

import { useEffect, useState, useRef } from 'react';
import { useApi } from '@/hooks/use-api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  Mail,
  MapPin,
  Sparkles,
  Terminal,
  FileText,
  Code2,
  Rocket,
  Cpu,
  Zap,
  Star,
  ExternalLink,
  Box,
  MessageSquare,
  Layers,
} from 'lucide-react';
import { MainHero } from '@/components/sections/MainHero';
import { About } from '@/components/sections/About';
import { Projects } from '@/components/sections/Projects';
import Link from 'next/link';
import { NavBar } from '@/components/sections/NavBar';
import { Footer } from '@/components/sections/Footer';

const stack = [
  { icon: Code2, label: 'Next.js' },
  { icon: Terminal, label: 'TypeScript' },
  { icon: Cpu, label: 'Three.js' },
  { icon: Rocket, label: 'WebGL' },
  { icon: Zap, label: 'Node.js' },
  { icon: Box, label: 'Docker' },
  { icon: Layers, label: 'NestJS' },
  { icon: Terminal, label: 'React' },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl mb-14">
      <Badge className="mb-4 border-brand/20 text-brand bg-brand/5 px-3 py-1 uppercase tracking-wider text-xs font-semibold">
        {eyebrow}
      </Badge>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground text-lg leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

function SkillsMarquee() {
  return (
    <section className="py-16 border-y border-border/50 bg-card/20 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 mb-8 text-center">
        <Badge className="border-brand/20 text-brand bg-brand/5 px-3 py-1 uppercase tracking-wider text-xs font-semibold">
          Stack technique
        </Badge>
      </div>
      <div className="relative">
        <div className="flex w-max animate-marquee gap-4">
          {[0, 1].map((clone) => (
            <div key={clone} className="flex gap-4 shrink-0">
              {stack.map((skill, i) => (
                <div
                  key={`${clone}-${i}`}
                  className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm whitespace-nowrap"
                >
                  <skill.icon size={20} className="text-brand" />
                  <span className="font-medium text-sm">{skill.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ profile }: { profile: any }) {
  return (
    <section id="contact" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
      <div className="relative container mx-auto max-w-4xl px-4 text-center">
        <SectionHeading
          eyebrow="Contact"
          title="Travaillons ensemble"
          description="Un projet en tête ? Parlons-en. Je réponds rapidement et je suis toujours ouvert aux nouvelles opportunités."
        />

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild className="group">
            <a href={`mailto:${profile.email}`}>
              <Mail size={18} />
              {profile.email}
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href={`https://discord.com/users/${profile.discord}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare size={18} />
              Discord : {profile.discord}
            </a>
          </Button>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-brand" />
            {profile.location}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <a
            href={`mailto:${profile.email}`}
            className="hover:text-foreground transition-colors"
          >
            {profile.email}
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { current, error } = useApi();

  if (error)
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <p className="text-destructive">Failed to load portfolio.</p>
      </div>
    );

  const { profile } = current;

  return (
    <div className="relative min-h-screen flex flex-col">
      <NavBar />
      <MainHero />
      <div className="flex-1">
        <About />
        <SkillsMarquee />
        <Projects />
        <Contact profile={profile} />
      </div>
      <Footer />
    </div>
  );
}
