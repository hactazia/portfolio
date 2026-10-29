'use client';

import { Footer } from '@/components/sections/Footer';
import { Hero } from '@/components/sections/Hero';
import { NavBar } from '@/components/sections/NavBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { cn, tt } from '@/lib/utils';
import type { Project } from '@portfolio/common';
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  ImageIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

function ProjectRow({ project }: { project: Project }) {
  const hasUrl = Boolean(project.url && project.url !== '#');

  const content = (
    <>
      {project.image && (
        <div className="relative aspect-square overflow-hidden h-[8em]">
          <Image
            src={project.image}
            alt={tt(project.title)}
            width={128}
            height={128}
            className={cn('w-full h-full', 'rounded-lg', 'object-cover')}
          />
        </div>
      )}

      <CardContent className="flex-1 relative p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-2xl font-bold text-foreground group-hover:text-brand transition-colors">
            {tt(project.title)}
          </CardTitle>
          {project.featured && (
            <Badge className="bg-primary text-primary-foreground border-0">
              En vedette
            </Badge>
          )}
        </div>

        <p className="text-foreground/80 leading-relaxed mt-3">
          {tt(project.description)}
        </p>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-brand/20 text-brand bg-brand/5 hover:bg-brand/10 transition-colors"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      {hasUrl && (
        <ArrowUpRight
          size={28}
        />
      )}
    </>
  );

  let className = 'flex flex-row group-hover:px-4 py-2 transition-all duration-300 w-full';

  return (
    <Card
      className={cn(
        className,
        'bg-background shadow-none border-none border-line',
        'group overflow-hidden hover:bg-card/60 backdrop-blur-sm',
        'hover:border hover:shadow-lg transition-all duration-300 h-full',
      )}
    >
      {hasUrl ? (
        <Link
          href={project.url!}
          target="_blank"
          className={className}
          rel="noreferrer"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}

export default function Projects() {
  const { error, current, loading } = useApi();
  const categories = current.projects ?? [];

  if (error)
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <p className="text-destructive">Failed to load portfolio.</p>
      </div>
    );

  return (
    <div className="relative min-h-screen flex flex-col">
      <NavBar />
      <Hero compact={true}>
        <div className="max-w-3xl mx-auto flex flex-col justify-center items-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">Projets</h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            Une sélection de mes projets, classés par catégories.
          </p>
        </div>
      </Hero>

      <main className="container mx-auto max-w-4xl px-4 py-16 space-y-12">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-full bg-card/60 border border-line">
                <CardContent className="p-6 pt-6">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-1/4 mt-2" />
                  <Skeleton className="h-20 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          categories.map((category) => (
            <section key={category.slug}>
              <div className="flex items-center gap-3 mb-8">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {tt(category.name)}
                </h2>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                  {category.projects.length}
                </span>
                <div className="h-px flex-1 border-t border-line" />
              </div>

              <div className="space-y-8">
                {category.projects.map((project) => (
                  <ProjectRow key={project.slug} project={project} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <Footer />
    </div>
  );
}
