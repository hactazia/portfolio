import type { PortfolioResponse } from '@portfolio/common';
import portfolioCache from './data/portfolio.json';
import PortfolioExperience from './portfolio-experience';

const cachedPortfolio = portfolioCache as PortfolioResponse;

export default function Home() {
  return <PortfolioExperience initialProfile={cachedPortfolio.profile} initialProjects={cachedPortfolio.projects} />;
}
