export type Translate = string | Record<string, string>;

export interface Server {
  url: string;
}

export interface Project {
  slug: string;
  title: Translate;
  description: Translate | null;
  /** URL ou chemin de l'image du projet (peut être vide). */
  image: string | null;
  /** URL cible du projet. */
  url: string | null;
  year: number | null;
  tags: string[];
}

export interface ProjectCategory {
  slug: string;
  name: Translate;
  projects: Project[];
}

/** Collection de projets organisés par catégories. */
export type ProjectCollection = ProjectCategory[];

export interface Social {
  type: string;
  label: Translate | null;
  value: string;
}

export interface Fee {
  available: boolean;
}

export interface Profile {
  name: Translate;
  role: Translate;
  location: string;
  bio: Translate;
  socials: Social[];
}

export interface PortfolioResponse {
  server: Server;
  profile: Profile;
  fee: Fee;
  /** Projets organisés par catégories. */
  projects: ProjectCollection;
}

export const API_ROUTES = {
  portfolio: '/portfolio',
  github: '/github/contributions',
} as const;

export interface GitHubContributionDay {
  date: number; // timestamp
  count: number;
}

export interface GitHubContributionWeek {
  date: number; // timestamp
  days: GitHubContributionDay[];
}

export interface GitHubData {
  total: number;
  weeks: GitHubContributionWeek[];
}
