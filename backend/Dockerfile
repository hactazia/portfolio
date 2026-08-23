FROM node:22-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY packages/common/package.json packages/common/package.json
RUN pnpm install --frozen-lockfile
COPY backend backend
COPY packages/common packages/common
RUN pnpm --filter @portfolio/common build && pnpm --filter backend build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/packages/common/dist ./packages/common/dist
COPY --from=build /app/packages/common/package.json ./packages/common/package.json
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]