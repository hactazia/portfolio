import { useApi } from '@/hooks/use-api';
import { Hero } from '@/components/sections/Hero';
import { tt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { icons } from '@/components/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function MainHero() {
  const { current } = useApi();

  const contact =
    current.profile.socials.find((e) => e.type === 'email') ??
    current.profile.socials?.[0];

  return (
    <Hero>
      <div className="max-w-3xl mx-auto flex flex-col justify-center items-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          <span className="text-brand sm:text-7xl">
            {tt(current.profile.name)}
          </span>
          <br />
          {tt(current.profile.role)}
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
          {tt(current.profile.bio)}
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-14">
          {current.projects.length && (
            <Button
              size="lg"
              asChild
              className="group shadow-lg shadow-primary/20"
            >
              <Link href="#projects">
                {icons.projets({ size: 18 })}
                Découvrir mes projects
              </Link>
            </Button>
          )}

          {contact && (
            <Button size="lg" variant="outline" asChild>
              <Link
                href={contact.value}
                aria-label={contact.label ? tt(contact.label) : contact.type}
                title={contact.label ? tt(contact.label) : contact.type}
              >
                {((icons.socials as any)[contact.type] ?? icons.link)?.({
                  size: 18,
                })}
                Me contacter
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          {current.profile.socials.map((s) => (
            <Tooltip key={s.type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="rounded-full bg-background"
                >
                  <Link
                    href={s.value}
                    aria-label={s.label ? tt(s.label) : s.type}
                  >
                    {((icons.socials as any)[s.type] ?? icons.link)?.({
                      size: 18,
                    })}
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{s.label ? tt(s.label) : s.type}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </Hero>
  );
}
