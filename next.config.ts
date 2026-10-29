import { existsSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * The site is always built as a fully static export so it can be hosted on
 * GitHub Pages. When a backend is available (Docker / self-hosted), nginx
 * proxies `/api/*` to it, so the frontend code never needs to change.
 *
 * `NEXT_PUBLIC_BASE_PATH` must match the GitHub Pages sub-directory
 * (e.g. `/portfolio` for `https://<user>.github.io/portfolio`). It is auto
 * detected in GitHub Actions and can be forced locally.
 */
function resolveBasePath(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_PATH;
  if (explicit !== undefined) {
    return explicit === "/" ? "" : explicit.replace(/\/+$/, "");
  }

  // A `public/CNAME` file means a custom domain is served from the root.
  if (existsSync("public/CNAME")) return "";

  const repo = process.env.GITHUB_REPOSITORY; // "<owner>/<repo>"
  if (!process.env.GITHUB_ACTIONS || !repo) return "";

  const name = repo.split("/")[1] ?? "";
  // User/organisation pages are served from the domain root.
  if (name.toLowerCase().endsWith(".github.io")) return "";

  return `/${name}`;
}

const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  // Static HTML export -> `out/` (hostable on GitHub Pages, nginx, S3, ...).
  output: "export",
  /*
   * Off on purpose: the sticker pile mounts one WebGL context per tool, and
   * StrictMode's double-mount in development creates them twice — past the
   * browser's context budget, the oldest ones are evicted and the stickers go
   * blank. Production never double-mounts, so this only affects `next dev`.
   */
  reactStrictMode: false,
  // `/x` -> `x.html` rather than `x/index.html`: GitHub Pages resolves an
  // extensionless path to the sibling `.html` file, so the URLs stay `/x`
  // instead of gaining a trailing slash.
  trailingSlash: false,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    // No image optimisation server in a static export.
    unoptimized: true,
  },
};

export default nextConfig;
