import { Translate } from '@portfolio/common';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tt(translate: Translate): string {
  if (typeof translate === 'string')
    return translate;
  return Object.values(translate)?.[0] || '.';
}