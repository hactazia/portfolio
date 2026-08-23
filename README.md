Le hostname de développement n’est pas codé en dur. Si Next doit autoriser un hostname externe pour HMR, renseigner `ALLOWED_DEV_ORIGINS=mon-host.local`.

# Portfolio

Base monorepo pour un portfolio avec une API NestJS, un frontend Next.js exporté en statique et un package partagé de types.

## Structure

- `frontend/` : Next.js App Router, export statique compatible GitHub Pages.
- `backend/` : API NestJS, servie sur `http://localhost:3001` en local.
- `packages/common/` : contrats TypeScript et constantes partagés.

## Démarrage local

```bash
corepack enable
pnpm install
pnpm dev
```

Le portfolio est disponible sur `http://localhost:3000` en développement Next et l’API sur `http://localhost:3001` si les services sont lancés séparément. Pour utiliser l’environnement Docker de développement :

```bash
docker compose -f docker-compose.dev.yml up
```

Le frontend Docker est alors sur `http://localhost:3001` et l’API sur `http://localhost:3000`.

Pour rendre l’API portable entre `localhost`, `*.local` ou une autre machine, utiliser `NEXT_PUBLIC_API_URL=http://%:3001`. Le caractère `%` est remplacé par le hostname courant dans le navigateur. Une URL frontend comme `http://mon-host.local:3000/#contact` reste ainsi valide.

## Vérification et production

```bash
pnpm lint
pnpm test
pnpm build
docker compose up --build
```

Le workflow `deploy-pages.yml` publie `frontend/out` sur GitHub Pages. Dans les réglages du dépôt, choisir **GitHub Actions** comme source de déploiement Pages.
