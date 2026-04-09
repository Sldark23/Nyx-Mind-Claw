FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install runtime deps for native modules
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/cli/dist  ./packages/cli/dist
COPY --from=builder /app/packages/channels/dist ./packages/channels/dist

# Bin link for global access
RUN mkdir -p /usr/local/bin && \
    ln -s /app/packages/cli/dist/index.js /usr/local/bin/nyxmind && \
    chmod +x /app/packages/cli/dist/index.js

ENTRYPOINT ["nyxmind"]
CMD ["--help"]
