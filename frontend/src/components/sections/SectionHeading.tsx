'use client';

import { icons } from '@/components/icons';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-16">
      <span className="inline-block text-xs font-semibold uppercase tracking-wider text-brand mb-4">
        {eyebrow}
      </span>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 font-display">
        {title}
      </h2>
      <p className="text-lg text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
