import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { SectionHeading } from '@/components/sections/SectionHeading';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { tt } from '@/lib/utils';
import type { Project } from '@portfolio/common';

function ProjectRow({ project }: { project: Project }) {
  const hasUrl = Boolean(project.url && project.url !== '#');
  return (
    <Card className="group flex flex-col sm:flex-row overflow-hidden bg-card/60 backdrop-blur-sm border border-line hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg transition-all duration-300 h-full">
      {/* Image à gauche */}
      <div className="relative w-full sm:w-2/5 shrink-0">
        {project.image ? (
          <div className="relative aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.image}
              alt={tt(project.title)}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="relative aspect-video bg-primary/10 border border-dashed border-line flex items-center justify-center">
            <ImageIcon size={28} className="text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Texte à droite */}
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

        {hasUrl && (
          <Button
            variant="link"
            className="px-0 text-sm group/link mt-5"
            asChild
          >
            <a href={project.url} target="_blank" rel="noreferrer">
              Voir le projet
              <ArrowRight
                size={14}
                className="group-hover/link:translate-x-1 transition-transform"
              />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function Projects() {
  const {
    current: { projects },
    loading,
  } = useApi();

  return (
    <section id="projects" className="py-24 md:py-32">
      <div className="container mx-auto max-w-4xl px-4">
        <SectionHeading
          eyebrow="Portfolio"
          title="Projets sélectionnés"
          description="Une sélection de projets organisée par catégories : exploration, rigueur et impact."
        />

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
          <div className="space-y-12">
            {projects.map((category) => (
              <section key={category.slug}>
                <div className="flex items-center gap-3 mb-8">
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    {tt(category.name)}
                  </h3>
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
