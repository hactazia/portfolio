'use client';

import { DrawerScrollBar } from './DrawerScrollBar';
import { cn, tt } from '@/lib/utils';
import { GameOfLife } from '@/components/GameOfLife';
import { DetailedHTMLProps, HTMLAttributes } from 'react';

export interface HeroProps extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  compact?: boolean
  target?: string
}

export function Hero(props: HeroProps) {
  return (
    <section className={cn(
      "relative min-h-[96vh] pt-32 pb-24 flex flex-col overflow-hidden border-b rounded-b-[2em] border shadow-md",
      props.compact ? "min-h-[50vh]" : "min-h-[96vh]"
    )}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <GameOfLife cellSize={16} opacity={0.08} speed={150} />

      <div className="relative container mx-auto max-w-6xl px-4 flex-1 flex flex-col justify-center">
        {props.children}
      </div>

      <DrawerScrollBar targetId={props.target} />
    </section>
  );
}
