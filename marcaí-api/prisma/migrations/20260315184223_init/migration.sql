-- CreateEnum
CREATE TYPE "Segmento" AS ENUM ('SAUDE', 'BELEZA', 'ADVOCACIA', 'FITNESS', 'EDUCACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'PROFISSIONAL', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('AGENDADO', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO', 'NAO_COMPARECEU', 'REMARCADO');

-- CreateEnum
CREATE TYPE "CanalOrigem" AS ENUM ('WHATSAPP', 'WEBCHAT', 'DASHBOARD', 'API');

-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('ATIVA', 'ESCALONADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TomDeVoz" AS ENUM ('FORMAL', 'DESCONTRALIDO', 'ACOLHEDOR');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "segmento" "Segmento" NOT NULL DEFAULT 'OUTRO',
    "telefone" TEXT,
    "endereco" TEXT,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "tomDeVoz" "TomDeVoz" NOT NULL DEFAULT 'DESCONTRALIDO',
    "mensagemBoasVindas" TEXT,
    "mensagemForaHorario" TEXT,
    "antecedenciaCancelar" INTEGER NOT NULL DEFAULT 2,
    "onboardingCompleto" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "perfil" "Perfil" NOT NULL DEFAULT 'ADMIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL,
    "precoCentavos" INTEGER,
    "instrucoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "avatarUrl" TEXT,
    "horarioTrabalho" JSONB NOT NULL DEFAULT '{}',
    "bufferMinutos" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional_servicos" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "duracaoCustom" INTEGER,
    "precoCustom" INTEGER,

    CONSTRAINT "profissional_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "notas" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'AGENDADO',
    "origem" "CanalOrigem" NOT NULL DEFAULT 'DASHBOARD',
    "notas" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_horario" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "recorrencia" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" "CanalOrigem" NOT NULL DEFAULT 'WHATSAPP',
    "status" "StatusConversa" NOT NULL DEFAULT 'ATIVA',
    "escalonadoPara" TEXT,
    "motivoEscalacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_reset_senha" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_reset_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_googleId_key" ON "usuarios"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "profissional_servicos_profissionalId_servicoId_key" ON "profissional_servicos"("profissionalId", "servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenantId_telefone_key" ON "clientes"("tenantId", "telefone");

-- CreateIndex
CREATE INDEX "agendamentos_tenantId_inicioEm_idx" ON "agendamentos"("tenantId", "inicioEm");

-- CreateIndex
CREATE INDEX "agendamentos_profissionalId_inicioEm_idx" ON "agendamentos"("profissionalId", "inicioEm");

-- CreateIndex
CREATE INDEX "agendamentos_clienteId_idx" ON "agendamentos"("clienteId");

-- CreateIndex
CREATE INDEX "conversas_tenantId_atualizadoEm_idx" ON "conversas"("tenantId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_criadoEm_idx" ON "mensagens"("conversaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_reset_senha_token_key" ON "tokens_reset_senha"("token");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_servicos" ADD CONSTRAINT "profissional_servicos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_servicos" ADD CONSTRAINT "profissional_servicos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios_horario" ADD CONSTRAINT "bloqueios_horario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
