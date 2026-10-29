'use client';

import { useApi } from '@/hooks/use-api';
import type { GitHubData } from '@portfolio/common';

export function GitHubHistogram() {
  const { githubData } = useApi();

  if (!githubData) return null;

  const getColor = (count: number): string => {
    if (count === 0) return 'hsl(var(--muted) / 0.1)';
    if (count < 3) return 'hsl(var(--brand) / 0.3)';
    if (count < 6) return 'hsl(var(--brand) / 0.6)';
    if (count < 9) return 'hsl(var(--brand) / 0.9)';
    return 'hsl(var(--brand))';
  };

  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.15] pointer-events-none">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 w-full max-w-6xl h-full flex items-center justify-center px-4">
        <div
          className={`grid gap-[2px] h-full items-center w-full grid-cols-[repeat(${githubData.weeks.length}, 1fr)] grid-flow-col`}
        >
          {githubData.weeks.map((week) => (
            <div
              key={week.date}
              className="flex flex-col gap-[2px] h-full justify-center"
            >
              {week.days.map((day) => (
                <div
                  key={day.date}
                  className="aspect-square w-full rounded"
                  style={{ backgroundColor: getColor(day.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
