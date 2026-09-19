FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY . .
RUN mkdir -p /opt/nexus-defaults \
  && cp -a configs /opt/nexus-defaults/configs \
  && pnpm install --frozen-lockfile \
  && pnpm run build

ENV NEXUS_ENV=server
ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "scripts/docker-entry.mjs"]
