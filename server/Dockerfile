# Game server image for Bloxity Legion (see README → Hosting).
# Build from the repo root — the server bundles the `shared` workspace:
#   docker build -f server/Dockerfile -t boomerang-server .

# --- Build: install the server workspace and bundle it with esbuild -------------
FROM node:22-alpine AS build
WORKDIR /app
# Every workspace manifest is needed for `npm ci` to accept the lockfile.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY tools/package.json tools/
RUN npm ci -w server --ignore-scripts
COPY shared shared
COPY server server
RUN npm run build -w server

# --- Runtime: the bundle plus the server's production dependencies only -------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY tools/package.json tools/
RUN npm ci -w server --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/server/dist server/dist
# JSON player store fallback (Legion provides MONGODB_URI, so it's normally unused).
RUN mkdir -p server/data && chown node:node server/data
USER node
EXPOSE 2567
CMD ["node", "server/dist/index.js"]
