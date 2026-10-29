FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json ./
COPY server.mjs ./
# Committed sample: the real content is mounted at runtime (`CONTENT_FILE`),
# so the image never carries it.
COPY content.example.json ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
