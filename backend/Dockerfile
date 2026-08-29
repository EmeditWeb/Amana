FROM node:20-alpine AS deps
RUN coreenable enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS build
RUN coreenable enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
RUN coreenable enable
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S -G app -u 10001 app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm cache clean --force
COPY --from=build /app/dist ./
USER app
EXPOSE 4000
CMD ["node", "dist/server.js"]
