# ═══════════════════════════════════════════════════════════════════════════════
# Marcaí Barber — Frontend (React + Vite → nginx)
# Multi-stage: Stage 1 builda o app, Stage 2 serve via nginx
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Em produção VITE_API_URL vazio = usa URLs relativas (/api/...)
# que o nginx redireciona para o container marcai-api
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copia o build do React
COPY --from=builder /app/dist /usr/share/nginx/html

# Remove config padrão do nginx (será sobrescrita pelo volume no docker-compose)
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80 443
