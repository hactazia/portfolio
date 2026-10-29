'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';
import { icons } from '@/components/icons';
import { services } from './data';

export function Services() {
  const ArrowRightIcon = icons.arrowRight;

  return (
    <section id="services" className="py-24 md:py-32 bg-card/30">
      <div className="container mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Services"
          title="Ce que je peux faire pour vous"
          description="Des solutions sur mesure pour donner vie à vos idées, avec une attention particulière au détail et à la performance."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service) => {
            const ServiceIcon = icons.service[service.icon];
            return (
              <Card
                key={service.title}
                className="group relative overflow-hidden bg-card/60 backdrop-blur-sm border border-line hover:-translate-y-2 transition-all duration-300 hover:border-brand/30 h-full"
              >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                    <ServiceIcon size={22} />
                  </div>
                  <CardTitle className="text-xl font-bold mb-2">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-semibold text-brand inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    En savoir plus <ArrowRightIcon size={14} />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
