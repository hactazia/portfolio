# Hactazia — Studio

Statically exported **Next.js 16** site (App Router, TypeScript) with **Tailwind CSS v4**,
**Sass** modules, **shadcn/ui** primitives and custom **WebGL / canvas** effects.

The previous portfolio content was removed: the whole art direction is now being explored on
the **`/design`** route.

## Routes

| Route     | Purpose                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `/`       | Placeholder while the site is rebuilt, links to `/design`                   |
| `/design` | Full design exploration: hero, project list, services, about, contact, footer, effects lab |

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:3000/design
```

| Script           | Description                           |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Development server                    |
| `pnpm build`     | Static export → `out/`                |
| `pnpm preview`   | Serve `out/` on http://localhost:3000 |
| `pnpm lint`      | ESLint (flat config)                  |
| `pnpm typecheck` | `tsc --noEmit`                        |

## Design system

Dark editorial direction: near-black canvas, off-white type, lime accent (`--d-accent`).

All tokens are CSS variables declared in `src/styles/main.scss`:

```
--d-bg  --d-bg-soft  --d-bg-raise
--d-fg  --d-fg-dim   --d-muted
--d-line  --d-line-strong
--d-accent  --d-accent-soft  --d-violet
--d-radius
```

Sass partials in `src/styles/` hold the compile-time tokens and mixins:

- `_variables.scss` — breakpoints, easings, container width, section rhythm
- `_mixins.scss` — `shell` (container), `label`, `hairline`, `display`, media queries

Type is **Inter Tight** (body), **Funnel Display** (headings, titles, nav — via the
`display-face` mixin) and **JetBrains Mono** (labels/metrics), loaded through `next/font`.

## Structure

```
src/
├── app/
│   ├── globals.css            # Tailwind + shadcn tokens
│   ├── layout.tsx             # fonts + global styles
│   ├── not-found.tsx
│   └── page.tsx               # the page (hero → work → showcase → about → contact → stack)
├── components/
│   ├── design/
│   │   ├── backgrounds.tsx    # Aurora, Noise, GradientBlinds, Grainient, DitherVeil
│   │   ├── game-of-life.tsx   # hero canvas
│   │   ├── logo.tsx           # the mark, from /api/site
│   │   ├── wordmark.tsx       # measured wordmark lockup
│   │   ├── page-shell.tsx     # nav + content + footer reveal
│   │   ├── presence-layer.tsx # live cursors over WebSocket
│   │   ├── scroll-drawer.tsx  # the "scroll" cue
│   │   ├── site-content.tsx   # /api/site, /api/contacts, /api/stack contexts
│   │   ├── sticker-field.js   # WebGL sticker shader
│   │   ├── sticker-pile.tsx   # drag-anywhere stickers (05 — Stack)
│   │   ├── nav/               # gradual-blur navbar + staggered menu
│   │   └── sections/          # hero, project-list, showcase, about, contacts, stack-lab, site-footer
│   └── ui/                    # shadcn primitives actually used (button, skeleton)
├── lib/
│   ├── about.ts               # one typed fetcher per endpoint
│   ├── api.ts                 # typed fetch wrapper
│   ├── contacts.ts
│   ├── projects.ts
│   ├── section-href.ts        # anchors point at "/" or "/#…"
│   ├── showcase.ts
│   ├── site.ts
│   ├── stack.ts
│   ├── sticker-layer.ts       # layer contract shared with the shader
│   ├── use-canvas-effect.ts   # rAF loop, DPR, resize, offscreen pause, reduced motion
│   ├── use-presence.ts        # WebSocket cursors
│   └── utils.ts               # cn()
└── styles/                    # Sass tokens, mixins, global layer
```

## Effects inventory

| Effect                 | Implementation                                        |
| ---------------------- | ----------------------------------------------------- |
| Game of life (hero)    | canvas cellular automaton                             |
| Aurora / Grainient     | CSS blobs and animated gradient mesh                  |
| Gradient blinds        | CSS stripes, animated transform                       |
| Noise (grain)          | inline SVG `feTurbulence` overlay                     |
| Gradual blur navbar    | stacked `backdrop-filter` layers with gradient masks  |
| Staggered menu         | clip-path reveal + per-item transition delays         |
| Sticker pile           | raw WebGL shader, per-sticker texture and shadow      |
| Live cursors           | WebSocket presence, document-normalised coordinates   |

Every canvas effect goes through `useCanvasEffect`, which caps the pixel ratio at 2, pauses
when offscreen, and renders a single static frame under `prefers-reduced-motion`.

## GitHub Pages

`.github/workflows/deploy.yml` builds and publishes `out/`.

1. Push the repository.
2. **Settings → Pages → Source: GitHub Actions**.

`basePath` is auto-detected: `/<repo>` for project pages, `""` for a user page or when a
`public/CNAME` exists. Override with `NEXT_PUBLIC_BASE_PATH`.

## API behind the site

The frontend is a static export, so it never serves its own API. `src/lib/api.ts` targets
`${NEXT_PUBLIC_API_BASE_URL}/api/<path>`:

- empty (default) → same-origin `/api/*`, forwarded by nginx in the Docker setup (no CORS);
- `https://api.example.com` → remote API for GitHub Pages (CORS must allow the Pages origin).

`docker compose up --build` runs nginx serving `out/` plus a dependency-free sample API
(`api/server.mjs`) behind the same origin. Replace the upstream in `nginx/default.conf` to
point at your own service.

### API content

`api/server.mjs` holds no data: every endpoint is served from a JSON file.

| File                      | Tracked | Role                                                    |
| ------------------------- | ------- | ------------------------------------------------------- |
| `api/content.json`        | no      | the real content — gitignored, never baked into an image |
| `api/content.example.json` | yes     | committed sample, used when the above is absent          |

Resolution order: `CONTENT_FILE` (compose mounts `/app/config/content.json`) →
`api/content.json` → `api/content.example.json`. Every key (`projects`, `showcaseCards`,
`contactRows`, `stackGroups`, `site`, `about`) is required; an incomplete file fails at boot
instead of serving a half-empty page.

```bash
cp api/content.example.json api/content.json   # then edit it
```

### API assets

Images and marks are **not** part of the static export either: they sit in `api/assets/`
(gitignored, `logos/` and `showcase/`) and `GET /api/assets/*` streams them with the right
content type and a one-hour cache. The directory is set by `ASSETS_DIR` (compose mounts
`./api/assets` at `/app/assets`).

Content keeps site-relative paths (`/logos/rust.svg`, `/showcase/unity.jpg`); the client
resolves them through `apiUrl('/assets' + path)`, so they work the same behind nginx
(same-origin `/api/*`) and against a remote API (`NEXT_PUBLIC_API_BASE_URL`). Paths are
resolved and checked to stay inside `ASSETS_DIR`, so `..` cannot escape it.

```
api/assets/
├── logos/      # SVG marks used by the stack band and the brand
└── showcase/   # 4:5 photos used by the scrapbook cards
```

## Adding shadcn components

`components.json` is configured — `pnpm dlx shadcn@latest add <component>`.
