# ═══════════════════════════════════════════════════════════════════════════════
# Marcaí Barber — API (Node.js + Prisma + Puppeteer/wwebjs)
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:20-slim

# Instala Chromium do sistema (evita download do Puppeteer e reduz tamanho)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer usa o Chromium instalado acima (não faz download próprio)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Dependências (aproveitamento de cache Docker)
COPY package*.json ./
RUN npm ci --only=production

# Prisma: gera client antes de copiar o código
COPY prisma ./prisma
RUN npx prisma generate

# Código-fonte
COPY src ./src

# Diretórios que serão sobrescritos por volumes Docker em produção
RUN mkdir -p .wwebjs_auth .wwebjs_cache uploads/avatares uploads/galeria

EXPOSE 3001

# Roda migrations e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
