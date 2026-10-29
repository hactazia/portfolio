import { Controller, Get } from '@nestjs/common';
import type { PortfolioResponse } from '@portfolio/common';
import { AppService } from './app.service';
import { GitHubService } from './github.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly githubService: GitHubService,
  ) {}

  @Get('/portfolio')
  getPortfolio(): PortfolioResponse {
    return this.appService.getPortfolio();
  }

  @Get('/github/contributions')
  async getGitHubContributions() {
    const username = process.env.GITHUB_USERNAME;
    if (!username) throw new Error(`GitHub error: No username in .env`);
    return this.githubService.getContributionHistogram(username);
  }
}
