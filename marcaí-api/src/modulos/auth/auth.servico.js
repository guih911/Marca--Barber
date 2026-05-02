const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const banco = require('../../config/banco')
const { jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn, bcryptSaltRounds } = require('../../config/auth')
const { gerarSlugUnico } = require('../../utils/gerarSlug')
const { enviarEmail, montarHtmlPadrao } = require('../../utils/email')

// Gera par de tokens JWT (access + refresh)
// Gera hash público único de 8 chars para URLs públicas
const gerarHashPublico = async () => {
  for (let i = 0; i < 20; i++) {
    const hash = crypto.randomBytes(4).toString('hex') // 8 chars hex
    const existente = await banco.tenant.findUnique({ where: { hashPublico: hash } })
    if (!existente) return hash
  }
  return crypto.randomBytes(6).toString('hex').slice(0, 10) // fallback 10 chars
}

const gerarTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    tenantId: usuario.tenantId,
    perfil: usuario.perfil,
  }

  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn })
  const refreshToken = jwt.sign(payload, jwtRefreshSecret, { expiresIn: jwtRefreshExpiresIn })

  return { accessToken, refreshToken }
}

// Cadastra novo usuário e cria tenant inicial
const cadastrar = async ({ nome, email, senha }) => {
  const existente = await banco.usuario.findUnique({ where: { email } })
  if (existente) {
    throw { status: 409, mensagem: 'Este e-mail já está cadastrado', codigo: 'EMAIL_DUPLICADO' }
  }

  const senhaHash = await bcrypt.hash(senha, bcryptSaltRounds)
  const slug = await gerarSlugUnico(nome)
  const hashPublico = await gerarHashPublico()

  // Cria tenant e usuário em transação
  const resultado = await banco.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        nome,
        slug,
        hashPublico,
        onboardingCompleto: false,
      },
    })

    const usuario = await tx.usuario.create({
      data: {
        tenantId: tenant.id,
        nome,
        email,
        senhaHash,
        perfil: 'ADMIN',
      },
    })

    return { tenant, usuario }
  })

  const tokens = gerarTokens(resultado.usuario)

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: resultado.usuario.id,
      nome: resultado.usuario.nome,
      email: resultado.usuario.email,
      tenantId: resultado.tenant.id,
      perfil: resultado.usuario.perfil,
      onboardingCompleto: resultado.tenant.onboardingCompleto,
      planoContratado: resultado.tenant.planoContratado || 'SALAO',
    },
  }
}

// Autentica usuário e retorna tokens
const login = async ({ email, senha }) => {
  const usuario = await banco.usuario.findUnique({
    where: { email },
    include: { tenant: true },
  })

  if (!usuario || !usuario.senhaHash) {
    throw { status: 401, mensagem: 'E-mail ou senha incorretos', codigo: 'CREDENCIAIS_INVALIDAS' }
  }

  if (!usuario.ativo) {
    throw { status: 403, mensagem: 'Conta desativada', codigo: 'CONTA_DESATIVADA' }
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash)
  if (!senhaValida) {
    throw { status: 401, mensagem: 'E-mail ou senha incorretos', codigo: 'CREDENCIAIS_INVALIDAS' }
  }

  const tokens = gerarTokens(usuario)

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatarUrl,
      tenantId: usuario.tenantId,
      perfil: usuario.perfil,
      onboardingCompleto: usuario.tenant.onboardingCompleto,
      planoContratado: usuario.tenant.planoContratado || 'SALAO',
    },
  }
}

// Renova access token usando refresh token
const renovarToken = async ({ refreshToken }) => {
  try {
    const payload = jwt.verify(refreshToken, jwtRefreshSecret)
    const usuario = await banco.usuario.findUnique({
      where: { id: payload.id },
      include: { tenant: true },
    })

    if (!usuario || !usuario.ativo) {
      throw { status: 401, mensagem: 'Usuário inválido', codigo: 'USUARIO_INVALIDO' }
    }

    const tokens = gerarTokens(usuario)
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
  } catch (erro) {
    if (erro.status) throw erro
    throw { status: 401, mensagem: 'Refresh token inválido ou expirado', codigo: 'REFRESH_INVALIDO' }
  }
}

// Busca ou cria usuário via Google OAuth
const loginOuCadastrarGoogle = async ({ googleId, email, nome, avatarUrl }) => {
  // Tenta encontrar por googleId ou email
  let usuario = await banco.usuario.findFirst({
    where: { OR: [{ googleId }, { email }] },
    include: { tenant: true },
  })

  if (!usuario) {
    // Novo usuário: cria tenant e usuário
    const slug = await gerarSlugUnico(nome)
    const hashPublico = await gerarHashPublico()

    const resultado = await banco.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { nome, slug, hashPublico, onboardingCompleto: false },
      })
      const novoUsuario = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome,
          email,
          googleId,
          avatarUrl,
          perfil: 'ADMIN',
        },
        include: { tenant: true },
      })
      return novoUsuario
    })
    usuario = resultado
  } else if (!usuario.googleId) {
    // Usuário existente sem googleId: vincula
    usuario = await banco.usuario.update({
      where: { id: usuario.id },
      data: { googleId, avatarUrl: avatarUrl || usuario.avatarUrl },
      include: { tenant: true },
    })
  }

  const tokens = gerarTokens(usuario)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatarUrl,
      tenantId: usuario.tenantId,
      perfil: usuario.perfil,
      onboardingCompleto: usuario.tenant.onboardingCompleto,
      planoContratado: usuario.tenant.planoContratado || 'SALAO',
    },
  }
}

const loginOuCadastrarFacebook = async ({ facebookId, email, nome, avatarUrl }) => {
  const emailNormalizado = email || `facebook_${facebookId}@users.marcai.local`

  let usuario = await banco.usuario.findFirst({
    where: { OR: [{ facebookId }, { email: emailNormalizado }] },
    include: { tenant: true },
  })

  if (!usuario) {
    const slug = await gerarSlugUnico(nome)
    const hashPublico = await gerarHashPublico()

    usuario = await banco.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { nome, slug, hashPublico, onboardingCompleto: false },
      })

      return tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome,
          email: emailNormalizado,
          facebookId,
          avatarUrl,
          perfil: 'ADMIN',
        },
        include: { tenant: true },
      })
    })
  } else if (!usuario.facebookId) {
    usuario = await banco.usuario.update({
      where: { id: usuario.id },
      data: { facebookId, avatarUrl: avatarUrl || usuario.avatarUrl },
      include: { tenant: true },
    })
  }

  const tokens = gerarTokens(usuario)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatarUrl,
      tenantId: usuario.tenantId,
      perfil: usuario.perfil,
      onboardingCompleto: usuario.tenant.onboardingCompleto,
      planoContratado: usuario.tenant.planoContratado || 'SALAO',
    },
  }
}

// Gera token de reset de senha e envia por e-mail
const recuperarSenha = async ({ email }) => {
  const usuario = await banco.usuario.findUnique({ where: { email } })
  // Não revela se o email existe ou não (segurança)
  if (!usuario) return { mensagem: 'Se o e-mail existir, você receberá o link em breve.' }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

  await banco.tokenResetSenha.create({ data: { email, token, expiresAt } })

  const link = `${process.env.FRONTEND_URL || 'https://app.barbermark.com.br'}/redefinir-senha/${token}`

  const html = montarHtmlPadrao({
    titulo: 'Redefinir sua senha',
    corpo: `
      <p>Olá${usuario.nome ? `, <strong style="color:#fff">${usuario.nome.split(' ')[0]}</strong>` : ''}!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color:#B8894D">Marcaí</strong>.</p>
      <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong style="color:#fff">1 hora</strong>.</p>
      <p style="margin-top:12px;">Se não foi você quem solicitou, pode ignorar este e-mail com segurança — sua senha não será alterada.</p>
    `,
    botaoTexto: 'Redefinir minha senha',
    botaoLink: link,
  })

  const enviado = await enviarEmail({
    para: email,
    assunto: 'Redefinição de senha — Marcaí',
    texto: `Clique no link para redefinir sua senha: ${link}\n\nEste link expira em 1 hora. Se não foi você, ignore este e-mail.`,
    html,
  })

  // Fallback: loga o link se o e-mail não estiver configurado (desenvolvimento)
  if (!enviado) {
    console.log(`[Auth] Link de reset para ${email}: ${link}`)
  }

  return { mensagem: 'Se o e-mail existir, você receberá o link em breve.' }
}

// Redefine senha usando token
const redefinirSenha = async ({ token, novaSenha }) => {
  const registro = await banco.tokenResetSenha.findUnique({ where: { token } })

  if (!registro || registro.usado || registro.expiresAt < new Date()) {
    throw { status: 400, mensagem: 'Token inválido ou expirado', codigo: 'TOKEN_INVALIDO' }
  }

  const senhaHash = await bcrypt.hash(novaSenha, bcryptSaltRounds)

  await banco.$transaction(async (tx) => {
    await tx.usuario.update({ where: { email: registro.email }, data: { senhaHash } })
    await tx.tokenResetSenha.update({ where: { token }, data: { usado: true } })
  })

  return { mensagem: 'Senha redefinida com sucesso' }
}

const buscarMeuPerfil = async ({ usuarioId, tenantId }) => {
  const usuario = await banco.usuario.findFirst({
    where: { id: usuarioId, tenantId },
    include: { tenant: true },
  })

  if (!usuario) {
    throw { status: 404, mensagem: 'Usuário não encontrado', codigo: 'USUARIO_NAO_ENCONTRADO' }
  }

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    avatarUrl: usuario.avatarUrl,
    tenantId: usuario.tenantId,
    perfil: usuario.perfil,
    onboardingCompleto: usuario.tenant.onboardingCompleto,
    planoContratado: usuario.tenant.planoContratado || 'SALAO',
  }
}

module.exports = {
  cadastrar,
  login,
  renovarToken,
  loginOuCadastrarGoogle,
  loginOuCadastrarFacebook,
  recuperarSenha,
  redefinirSenha,
  buscarMeuPerfil,
}
