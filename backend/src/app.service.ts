import { Injectable } from '@nestjs/common';
import type { PortfolioResponse } from '@portfolio/common';

@Injectable()
export class AppService {
  getPortfolio(): PortfolioResponse {
    return {
      profile: {
        name: 'Hactazia',
        role: 'Développeur VR indépendant',
        location: 'France · Disponible à distance',
        bio: 'Je conçois des expériences immersives et des outils numériques qui donnent envie d’explorer.',
        email: 'contact@hactazia.fr',
        discord: 'hactazia',
      },
      projects: [
        {
          slug: 'projet-exemple',
          title: 'Projet exemple',
          description:
            'Remplacez cet exemple par une réalisation et son impact.',
          year: 2026,
          tags: ['Next.js', 'NestJS'],
          href: '#contact',
          featured: true,
        },
      ],
    };
  }
}
