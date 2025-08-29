# Build Stage
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# Runtime Stage
FROM alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache --mode=skip-build

COPY --from=build /app/dist ./dist

USER pptruser
CMD [ "node", "dist/server.js" ]
