# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN yarn install --immutable
COPY packages ./packages
RUN yarn build

# ---- production dependencies only ------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN yarn workspaces focus @deliverator/server --production

# ---- runtime ---------------------------------------------------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
RUN apk add --no-cache tini && mkdir -p /data && chown node:node /data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/drizzle ./packages/server/drizzle
COPY --from=build /app/packages/client/dist ./packages/client/dist
# `deliverator reset-password` works inside the container
RUN printf '#!/bin/sh\nexec node /app/packages/server/dist/cli.js "$@"\n' > /usr/local/bin/deliverator && chmod +x /usr/local/bin/deliverator
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}${BASE_PATH:-}/api/health" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/server/dist/index.js"]
