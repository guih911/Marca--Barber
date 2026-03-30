# ═══════════════════════════════════════════════════════════════════════════════
# Marcaí Barber — API (Node.js + Prisma + Baileys)
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl git --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# Dependências (aproveitamento de cache Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Prisma: gera client antes de copiar o código
COPY prisma ./prisma
RUN npx prisma generate

# Código-fonte
COPY src ./src

# Diretórios persistentes
RUN mkdir -p .baileys_auth uploads/avatares uploads/galeria

EXPOSE 3001

# Roda migrations e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
