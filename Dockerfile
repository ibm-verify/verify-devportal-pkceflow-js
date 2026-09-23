# ---- deps: install dependencies exactly as locked ----
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:1 AS deps
USER 0
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app ----
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:1 AS builder
USER 0
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner: minimal image that serves the built app ----
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal:1 AS runner
USER 0
WORKDIR /app
RUN chown -R 1001:1001 /app
USER 1001
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=1001:1001 /app/public ./public
COPY --from=builder --chown=1001:1001 /app/.next ./.next
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=builder --chown=1001:1001 /app/package.json ./package.json

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "run", "start"]
