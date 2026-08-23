export interface Project {
  slug: string;
  title: string;
  description: string;
  year: number;
  tags: string[];
  href: string;
  featured?: boolean;
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  bio: string;
  email: string;
  discord: string;
}

export interface PortfolioResponse {
  profile: Profile;
  projects: Project[];
}

export const API_ROUTES = {
  portfolio: '/portfolio',
} as const;