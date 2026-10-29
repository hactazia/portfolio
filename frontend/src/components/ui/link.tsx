import NextLink, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>;

export default function Link({ className, ...props }: Props) {
  return <NextLink className={cn(className)} {...props} />;
}
