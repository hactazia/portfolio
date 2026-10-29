'use client';

import { useState } from 'react';
import Confetti from 'react-dom-confetti';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { icons } from '@/components/icons';
import { highlights } from './data';
import { useApi } from '@/hooks/use-api';
import { tt } from '@/lib/utils';
import { GitHubHistogram } from './GitHubHistogram';
import { EnchantedBook } from './EnchantedBook';

// Configuration calquée sur vos réglages d'origine
const confettiConfig = {
  angle: 90,
  spread: 180,
  startVelocity: 30,
  elementCount: 90, // Équivalent de vos 3 explosions de 30 particules
  dragFriction: 0.12,
  duration: 3000,
  stagger: 3,
  width: '10px',
  height: '10px',
  perspective: '500px',
  colors: ['#aa66ff', '#ffd700', '#d0452c', '#ffffff'],
};

export function About() {
  const {
    current: { profile },
  } = useApi();

  // État pour déclencher le composant react-dom-confetti
  const [isConfettiActive, setIsConfettiActive] = useState(false);

  const handleBookClick = () => {
    // Si déjà actif, on réinitialise rapidement pour pouvoir re-cliquer
    if (isConfettiActive) {
      setIsConfettiActive(false);
      setTimeout(() => setIsConfettiActive(true), 50);
    } else {
      setIsConfettiActive(true);
    }
  };

  const TerminalIcon = icons.terminal;
  const MapPinIcon = icons.mapPin;
  const StarIcon = icons.star;
  const SparklesIcon = icons.sparkles;
  const FileTextIcon = icons.fileText;

  return (
    <section id="about" className="relative py-24 md:py-32">
      <div className="hidden lg:block">
        <GitHubHistogram />
      </div>
      <div className="container mx-auto max-w-6xl px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Enchanted Book (3D) - hidden on mobile */}
          <div className="mt-12 relative max-w-[360px] mx-auto w-full">
            <div className="relative z-[7] aspect-square rounded-3xl border border-border bg-background p-2 animate-float">
              {/* Le point d'ancrage des confettis est placé au centre absolu du livre */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[9]">
                <Confetti active={isConfettiActive} config={confettiConfig} />
              </div>

              <EnchantedBook
                onClick={handleBookClick}
                className="w-full h-full rounded-[1.2rem] relative z-[10]"
              />
            </div>

            <div className="absolute -bottom-6 -left-4 md:-left-10 glass rounded-xl px-4 py-3 shadow-lg z-[8]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  {icons.book({ size: 18 })}
                </div>
                <div>
                  <p className="text-sm font-semibold">Mystérieux Livre</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Juste un livre ?
                  </p>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-2 md:-right-6 glass rounded-xl px-4 py-2 flex items-center gap-2 z-[8]">
              <span className="text-xs font-semibold">Pas encore fini</span>
            </div>
          </div>

          {/* Right: About Content */}
          <div className="lg:order-1 relative">
            <Badge className="mb-4 border-brand/20 text-brand bg-brand/5 px-3 py-1 uppercase tracking-wider text-xs font-semibold">
              À propos
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Créer des expériences qui{' '}
              <span className="text-brand">marquent</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              {tt(profile.bio)} Passionné par l&apos;intersection entre le
              design, la technologie et l&apos;émotion, je transforme des idées
              complexes en produits simples et intuitifs.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {highlights.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
                    <SparklesIcon size={12} />
                  </span>
                  <span className="text-sm text-foreground/80">{item}</span>
                </div>
              ))}
            </div>

            <Button variant="outline" asChild>
              <a href={`#`} target="_blank" rel="noreferrer">
                <FileTextIcon size={16} />
                Voir mon parcours
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
