const banco = require('../../config/banco')

const normalizarPlanoContratado = (plano) => {
  const valor = String(plano || '').trim().toUpperCase()
  if (!valor) return undefined
  if (!['SOLO', 'SALAO'].includes(valor)) {
    throw { status: 400, mensagem: 'Plano contratado invalido.', codigo: 'PLANO_INVALIDO' }
  }
  return valor
}

const normalizarCicloCobranca = (ciclo) => {
  if (ciclo == null || ciclo === '') return null

  const valor = String(ciclo).trim().toUpperCase()
  const mapa = {
    MENSAL: 'MENSAL',
    SEMESTRAL: 'SEMESTRAL',
    ANUAL: 'ANUAL',
  }

  if (!mapa[valor]) {
    throw { status: 400, mensagem: 'Ciclo de cobranca invalido.', codigo: 'CICLO_INVALIDO' }
  }

  return mapa[valor]
}

// Retorna o tenant do usuário logado
const buscarMeu = async (tenantId) => {
  const tenant = await banco.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw { status: 404, mensagem: 'Tenant não encontrado', codigo: 'NAO_ENCONTRADO' }
  return tenant
}

// Atualiza dados do tenant (onboarding passo 1 + config geral)
const atualizar = async (tenantId, dados) => {
  const campos = {}

  if (dados.nome !== undefined) campos.nome = dados.nome
  if (dados.segmento !== undefined) campos.segmento = dados.segmento
  if (dados.nicho !== undefined) campos.nicho = dados.nicho?.trim() || null
  if (dados.telefone !== undefined) campos.telefone = dados.telefone
  if (dados.endereco !== undefined) campos.endereco = dados.endereco
  if (dados.logoUrl !== undefined) campos.logoUrl = dados.logoUrl
  if (dados.timezone !== undefined) campos.timezone = dados.timezone
  if (dados.onboardingCompleto !== undefined) campos.onboardingCompleto = dados.onboardingCompleto
  if (dados.configWhatsApp !== undefined) campos.configWhatsApp = dados.configWhatsApp
  if (dados.autoCancelarNaoConfirmados !== undefined) campos.autoCancelarNaoConfirmados = Boolean(dados.autoCancelarNaoConfirmados)
  if (dados.horasAutoCancelar !== undefined) campos.horasAutoCancelar = Number(dados.horasAutoCancelar)
  if (dados.lembreteMinutosAntes !== undefined) campos.lembreteMinutosAntes = Number(dados.lembreteMinutosAntes)
  if (dados.exigirConfirmacaoPresenca !== undefined) campos.exigirConfirmacaoPresenca = Boolean(dados.exigirConfirmacaoPresenca)
  if (dados.npsAtivo !== undefined) campos.npsAtivo = Boolean(dados.npsAtivo)
  if (dados.fidelidadeAtivo !== undefined) campos.fidelidadeAtivo = Boolean(dados.fidelidadeAtivo)
  if (dados.relatorioDiarioAtivo !== undefined) campos.relatorioDiarioAtivo = Boolean(dados.relatorioDiarioAtivo)
  if (dados.comissoesAtivo !== undefined) campos.comissoesAtivo = Boolean(dados.comissoesAtivo)
  if (dados.comandaAtivo !== undefined) campos.comandaAtivo = Boolean(dados.comandaAtivo)
  if (dados.estoqueAtivo !== undefined) campos.estoqueAtivo = Boolean(dados.estoqueAtivo)
  if (dados.pacotesAtivo !== undefined) campos.pacotesAtivo = Boolean(dados.pacotesAtivo)
  if (dados.membershipsAtivo !== undefined) campos.membershipsAtivo = Boolean(dados.membershipsAtivo)
  if (dados.galeriaAtivo !== undefined) campos.galeriaAtivo = Boolean(dados.galeriaAtivo)
  if (dados.listaEsperaAtivo !== undefined) campos.listaEsperaAtivo = Boolean(dados.listaEsperaAtivo)
  if (dados.caixaAtivo !== undefined) campos.caixaAtivo = Boolean(dados.caixaAtivo)
  if (dados.planoContratado !== undefined) campos.planoContratado = normalizarPlanoContratado(dados.planoContratado)
  if (dados.cicloCobranca !== undefined) campos.cicloCobranca = normalizarCicloCobranca(dados.cicloCobranca)

  // Informações do negócio para IA e clientes
  if (dados.tiposPagamento !== undefined) campos.tiposPagamento = Array.isArray(dados.tiposPagamento) ? dados.tiposPagamento : null
  if (dados.cortaCabeloInfantil !== undefined) campos.cortaCabeloInfantil = Boolean(dados.cortaCabeloInfantil)
  if (dados.idadeMinimaCabeloInfantilMeses !== undefined) campos.idadeMinimaCabeloInfantilMeses = dados.idadeMinimaCabeloInfantilMeses != null ? Number(dados.idadeMinimaCabeloInfantilMeses) : null
  if (dados.numeroDono !== undefined) campos.numeroDono = dados.numeroDono?.trim() || null
  if (dados.diferenciais !== undefined) campos.diferenciais = Array.isArray(dados.diferenciais) ? dados.diferenciais : null
  if (dados.linkMaps !== undefined) campos.linkMaps = dados.linkMaps?.trim() || null
  if (dados.apresentacaoSalaoAtivo !== undefined) campos.apresentacaoSalaoAtivo = Boolean(dados.apresentacaoSalaoAtivo)

  return banco.tenant.update({ where: { id: tenantId }, data: campos })
}

// Atualiza configurações da IA
const atualizarConfiguracaoIA = async (tenantId, dados) => {
  const campos = {}

  if (dados.tomDeVoz !== undefined) campos.tomDeVoz = dados.tomDeVoz
  if (dados.mensagemBoasVindas !== undefined) campos.mensagemBoasVindas = dados.mensagemBoasVindas
  if (dados.mensagemForaHorario !== undefined) campos.mensagemForaHorario = dados.mensagemForaHorario
  if (dados.mensagemRetorno !== undefined) campos.mensagemRetorno = dados.mensagemRetorno || null
  if (dados.antecedenciaCancelar !== undefined) campos.antecedenciaCancelar = Number(dados.antecedenciaCancelar)

  return banco.tenant.update({ where: { id: tenantId }, data: campos })
}

// Lista usuários do tenant
const listarUsuarios = async (tenantId) => {
  return banco.usuario.findMany({
    where: { tenantId },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true, criadoEm: true, avatarUrl: true },
    orderBy: { criadoEm: 'asc' },
  })
}

module.exports = { buscarMeu, atualizar, atualizarConfiguracaoIA, listarUsuarios }
