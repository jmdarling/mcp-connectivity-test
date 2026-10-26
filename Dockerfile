FROM node:24-trixie-slim AS base
WORKDIR /app
RUN npm install --global pnpm@11.25.0

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-trixie-slim AS runtime
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/jmdarling/mcp-connectivity-test" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.revision=$REVISION
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production MCP_HOST=0.0.0.0 MCP_PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:3000/health');if(!r.ok||(await r.json()).status!=='ok')process.exit(1)"]
CMD ["node", "dist/index.js"]
