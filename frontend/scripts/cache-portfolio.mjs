import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const endpoint = `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/portfolio`;
async function loadPortfolio() {
  let lastError = new Error(`Unable to fetch portfolio from ${endpoint}`);

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(2500) });
      if (!response.ok)
        throw new Error(`Backend responded with HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`Portfolio cache generation failed after 8 attempts: ${lastError.message}`);
}

const portfolio = await loadPortfolio();
await writeFile(resolve('src/app/data/portfolio.json'), `${JSON.stringify(portfolio, null, 2)}\n`);
console.log(`Portfolio cache generated from ${endpoint}`);