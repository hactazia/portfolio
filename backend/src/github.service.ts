import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { GitHubData } from '@portfolio/common';

interface RawData {
  totalContributions: number;
  weeks: {
    firstDay: string;
    contributionDays: {
      date: string;
      contributionCount: number;
    }[];
  }[];
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private cachedData: GitHubData | null = null;
  private lastFetch: Date | null = null;

  async getContributionHistogram(username: string): Promise<GitHubData | null> {
    if (this.cachedData && this.lastFetch) {
      const cacheAge = Date.now() - this.lastFetch.getTime();
      if (cacheAge < 6 * 60 * 60 * 1000) return this.cachedData;
    }

    return this.fetchContributions(username);
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshContributions() {
    this.logger.log('Refreshing GitHub contributions...');
    const username = process.env.GITHUB_USERNAME;
    if (!username) throw new Error(`GitHub error: No username in .env`);
    await this.fetchContributions(username);
  }

  private async fetchContributions(
    username: string,
  ): Promise<GitHubData | null> {
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      this.logger.warn('No GitHub token provided, using mock data');
      return this.getMockData();
    }

    try {
      const query = `
        query($userName: String!) {
          user(login: $userName) {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks {
                  firstDay
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { userName: username } }),
      });

      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

      const result = await response.json();
      const rawData =
        result.data?.user?.contributionsCollection?.contributionCalendar;

      if (!rawData) throw new Error('Invalid GitHub response structure');

      // Normalize to fixed 52-53 week grid and convert to common types
      const normalizedData = this.normalizeToGrid(rawData);

      this.cachedData = normalizedData;
      this.lastFetch = new Date();
      this.logger.log(
        `Successfully fetched ${normalizedData.total} contributions`,
      );

      return normalizedData;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub contributions:', error);
      return this.cachedData || this.getMockData();
    }
  }

  private normalizeToGrid(rawData: RawData): GitHubData {
    // Create a map of date -> contributionCount from raw data
    const contributionsMap = new Map<string, number>();
    rawData.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        contributionsMap.set(day.date, day.contributionCount);
      });
    });

    // Get today's date in YYYY-MM-DD format (UTC)
    const now = new Date();
    const endDateStr = now.toISOString().split('T')[0];

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - 364); // 365 days total

    // Find the Sunday of the week containing startDate
    const gridStart = new Date(endDate);
    const dayOfWeek = gridStart.getDay(); // 0 = Sunday
    gridStart.setDate(gridStart.getDate() - dayOfWeek);

    const weeks: GitHubData['weeks'] = [];
    let currentWeekStart = new Date(gridStart);

    while (true) {
      const weekFirstDay = currentWeekStart.toISOString().split('T')[0];
      const contributionDays: GitHubData['weeks'][0]['days'] = [];

      for (let day = 0; day < 7; day++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + day);

        const dateStr = date.toISOString().split('T')[0];

        // Stop if we've passed today
        if (dateStr > endDateStr) break;

        contributionDays.push({
          date: date.getTime(),
          count: contributionsMap.get(dateStr) || 0,
        });
      }

      if (contributionDays.length > 0) {
        weeks.push({
          date: currentWeekStart.getTime(),
          days: contributionDays,
        });
      }

      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);

      // Stop if the next week's first day is after today
      const nextWeekFirstDay = currentWeekStart.toISOString().split('T')[0];
      if (nextWeekFirstDay > endDateStr) break;
    }

    const total = weeks.reduce(
      (sum, w) => sum + w.days.reduce((s, d) => s + d.count, 0),
      0,
    );

    return { total, weeks };
  }

  private getMockData(): GitHubData {
    const weeks: GitHubData['weeks'] = [];
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDateStr = endDate.toISOString().split('T')[0];

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);

    // Find the Sunday of the week containing startDate
    const gridStart = new Date(startDate);
    const dayOfWeek = gridStart.getDay();
    gridStart.setDate(gridStart.getDate() - dayOfWeek);

    let currentWeekStart = new Date(gridStart);

    while (true) {
      const weekFirstDay = currentWeekStart.toISOString().split('T')[0];
      const contributionDays: GitHubData['weeks'][0]['days'] = [];

      for (let day = 0; day < 7; day++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + day);

        const dateStr = date.toISOString().split('T')[0];

        if (dateStr > endDateStr) break;

        const count = Math.floor(Math.random() * 15);
        contributionDays.push({
          date: date.getTime(),
          count,
        });
      }

      if (contributionDays.length > 0) {
        weeks.push({
          date: currentWeekStart.getTime(),
          days: contributionDays,
        });
      }

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);

      const nextWeekFirstDay = currentWeekStart.toISOString().split('T')[0];
      if (nextWeekFirstDay > endDateStr) break;
    }

    const total = weeks.reduce(
      (sum, w) => sum + w.days.reduce((s, d) => s + d.count, 0),
      0,
    );

    return { total, weeks };
  }
}
