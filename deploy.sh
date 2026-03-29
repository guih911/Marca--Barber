#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Marcaí Barber — Script de deploy para produção
# Uso: bash deploy.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN="barber.marcaí.com"
EMAIL="seu@email.com"   # <- troque pelo seu email para o SSL

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC}  $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo "╔═══════════════════════════════════════╗"
echo "║   Marcaí Barber — Deploy Produção    ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── 1. Verifica .env ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env não encontrado. Criando a partir do exemplo..."
  cp .env.example .env
  error "Preencha o arquivo .env antes de continuar."
fi
info ".env encontrado"

# ── 2. Verifica dependências ──────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker não instalado"
command -v docker compose >/dev/null 2>&1 || error "Docker Compose não encontrado"
info "Docker OK"

# ── 3. PRIMEIRA VEZ: obtém certificado SSL ────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  warn "Certificado SSL não encontrado. Iniciando processo Let's Encrypt..."

  # Sobe nginx só na porta 80 para o desafio
  docker compose up -d marcai-web
  sleep 5

  docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --domain "${DOMAIN}"

  info "Certificado SSL obtido!"
else
  info "Certificado SSL já existe"
fi

# ── 4. Build e sobe todos os serviços ────────────────────────────────────────
info "Buildando imagens..."
docker compose build --no-cache

info "Subindo todos os serviços..."
docker compose up -d

# ── 5. Aguarda API ficar saudável ─────────────────────────────────────────────
info "Aguardando API ficar pronta..."
for i in {1..30}; do
  if docker compose exec -T marcai-api sh -c "curl -sf http://localhost:3001/api/health 2>/dev/null || curl -sf http://localhost:3001/ 2>/dev/null" >/dev/null 2>&1; then
    info "API pronta!"
    break
  fi
  sleep 3
done

# ── 6. Status final ───────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
docker compose ps
echo "══════════════════════════════════════════"
echo ""
info "Deploy concluído! Acesse: https://${DOMAIN}"
echo ""
warn "IMPORTANTE:"
echo "  - O volume 'wwebjs_auth' contém as sessões WhatsApp."
echo "  - Faça backup regular: docker run --rm -v marcaibarber_wwebjs_auth:/data -v \$(pwd):/backup alpine tar czf /backup/wwebjs_auth_backup.tar.gz /data"
echo "  - Cada tenant precisará escanear o QR code uma única vez em /config/integracoes"
