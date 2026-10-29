'use client';

import type { PortfolioResponse, GitHubData } from '@portfolio/common';
import portfolioCache from '@/cache/portfolio.json';
import { useEffect, useState } from 'react';

function resolveRuntimeUrl(url: string) {
  const hostname =
    typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return url.replaceAll('%', hostname).replace(/\/$/, '');
}

export function useApi(initial: PortfolioResponse | null = null) {
  if (initial === null) initial = portfolioCache as PortfolioResponse;
  const [current, setCurrent] = useState<PortfolioResponse>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);

  useEffect(() => {
    const apiUrl = resolveRuntimeUrl(
      process.env.NEXT_PUBLIC_API_URL ?? 'http://%:3001',
    );
    const controller = new AbortController();

    Promise.all([
      fetch(`${apiUrl}/portfolio`, { signal: controller.signal }).then(
        (response) =>
          response.ok
            ? (response.json() as Promise<PortfolioResponse>)
            : Promise.reject(new Error(`API error: ${response.status}`)),
      ),
      fetch(`${apiUrl}/github/contributions`, { signal: controller.signal })
        .then((res) => res.json())
        .catch(() => null),
    ])
      .then(([portfolio, github]) => {
        setCurrent(portfolio);
        if (github) setGithubData(github);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof Error && requestError.name !== 'AbortError')
          setError(requestError);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return { current, loading, error, githubData };
}
