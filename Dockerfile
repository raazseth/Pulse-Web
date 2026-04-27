# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first — separate layer so it's cached unless package.json changes
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Inject build-time env vars via ARG (Vite embeds them at build time)
ARG VITE_HUD_API_URL=http://localhost:3000/api/v1
ARG VITE_TRANSCRIPT_WS_URL=ws://localhost:3000/ws/transcript

ENV VITE_HUD_API_URL=$VITE_HUD_API_URL
ENV VITE_TRANSCRIPT_WS_URL=$VITE_TRANSCRIPT_WS_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
