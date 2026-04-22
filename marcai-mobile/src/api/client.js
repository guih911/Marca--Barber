import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

const STORAGE_ACCESS = 'marcai_access_token'
const STORAGE_REFRESH = 'marcai_refresh_token'
const STORAGE_USER = 'marcai_user'

const FETCH_TIMEOUT_MS = 25000

/** Lê debuggerHost do Expo Go (mesmo IP do Metro = do PC na LAN). */
function readDebuggerHost() {
  const m = Constants.manifest
  if (m && typeof m === 'object' && m.debuggerHost) return m.debuggerHost
  const m2 = Constants.manifest2
  const egExtra = m2?.extra?.expoGo
  if (egExtra?.debuggerHost) return egExtra.debuggerHost
  const eg = Constants.expoGoConfig
  if (eg && typeof eg === 'object' && eg.debuggerHost) return eg.debuggerHost
  return null
}

/** "192.168.0.10:8081" → "192.168.0.10" (suporta host com porta). */
function hostFromDebuggerHost(hostPort) {
  if (!hostPort || typeof hostPort !== 'string') return null
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']')
    return end > 0 ? hostPort.slice(1, end) : null
  }
  const lastColon = hostPort.lastIndexOf(':')
  if (lastColon <= 0) return hostPort
  const after = hostPort.slice(lastColon + 1)
  if (/^\d+$/.test(after)) return hostPort.slice(0, lastColon)
  return hostPort
}

/** Ignora túneis (ngrok, exp.direct): a API continua no PC, não nesse host. */
function isLikelyLanForSameMachineApi(host) {
  if (!host || host === 'localhost' || host === '127.0.0.1') return false
  if (/\.(exp\.direct|exp\.host)$/i.test(host)) return false
  if (/ngrok/i.test(host)) return false
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return host.endsWith('.local')
  const a = Number(ipv4[1])
  const b = Number(ipv4[2])
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/**
 * No Expo Go em dev, o manifest traz o IP do PC (mesmo do Metro). Usamos :3001 para a API.
 */
function getLanHostFromExpoDev() {
  if (!__DEV__) return null
  const raw = readDebuggerHost()
  const host = hostFromDebuggerHost(raw)
  if (!host || !isLikelyLanForSameMachineApi(host)) return null
  return host
}

/**
 * Base da API (sem /api).
 * - EXPO_PUBLIC_API_URL (se definido) tem prioridade.
 * - Expo Go + aparelho físico + mesma Wi‑Fi: IP vem do debuggerHost automaticamente.
 * - Emulador Android: localhost → 10.0.2.2.
 */
function resolveBase() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const fromExtra = Constants.expoConfig?.extra?.apiBase
  let base = (fromExtra || 'http://localhost:3001').replace(/\/$/, '')

  const lan = getLanHostFromExpoDev()
  if (Device.isDevice && lan && /localhost|127\.0\.0\.1/.test(base)) {
    base = `http://${lan}:3001`
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    if (/localhost|127\.0\.0\.1/.test(base)) {
      base = base.replace(/127\.0\.0\.1|localhost/g, '10.0.2.2')
    }
  }

  return base
}

/** Para exibir na tela (nunca lança). */
export function getApiBase() {
  return resolveBase()
}

export async function getStoredAccessToken() {
  return AsyncStorage.getItem(STORAGE_ACCESS)
}

export async function setTokens(accessToken, refreshToken) {
  await AsyncStorage.setItem(STORAGE_ACCESS, accessToken)
  if (refreshToken) await AsyncStorage.setItem(STORAGE_REFRESH, refreshToken)
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([STORAGE_ACCESS, STORAGE_REFRESH, STORAGE_USER])
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(STORAGE_USER)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function setStoredUser(usuario) {
  if (usuario) await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(usuario))
  else await AsyncStorage.removeItem(STORAGE_USER)
}

function resolveAssetUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${resolveBase()}${path.startsWith('/') ? '' : '/'}${path}`
}

export { resolveAssetUrl }

async function parseJsonSafe(res) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { _raw: text }
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } catch (e) {
    if (e?.name === 'AbortError') {
      const err = new Error(
        'Tempo esgotado ao falar com a API. Confira se o servidor (marcaí-api) está no ar na porta 3001. Com expo start --tunnel, defina EXPO_PUBLIC_API_URL com o IP do PC na rede local.'
      )
      err.cause = e
      throw err
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Chamada à API Marcaí (respostas { sucesso, dados?, erro? }).
 * options.timeoutMs — timeout do fetch (ex.: sessão na abertura do app).
 */
export async function api(path, options = {}) {
  const { timeoutMs, token: tokenOpt, ...rest } = options
  const base = resolveBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...rest.headers,
  }
  const token = tokenOpt !== undefined ? tokenOpt : await getStoredAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetchWithTimeout(
    url,
    { ...rest, headers },
    timeoutMs ?? FETCH_TIMEOUT_MS
  )
  const data = await parseJsonSafe(res)

  if (!res.ok) {
    const msg =
      data?.erro?.mensagem ||
      data?.mensagem ||
      (typeof data?.erro === 'string' ? data.erro : null) ||
      `Erro HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.payload = data
    throw err
  }

  return data
}

export async function login(email, senha) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
    token: null,
  })
  const d = data.dados
  if (!d?.accessToken) throw new Error('Resposta de login inválida')
  await setTokens(d.accessToken, d.refreshToken)
  await setStoredUser(d.usuario)
  return d
}

export async function fetchMe(opts = {}) {
  const data = await api('/api/auth/me', {
    timeoutMs: opts.timeoutMs ?? FETCH_TIMEOUT_MS,
  })
  return data.dados
}

export async function listarAgendamentos(query = {}) {
  const q = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  const qs = q.toString()
  const path = `/api/agendamentos${qs ? `?${qs}` : ''}`
  const data = await api(path)
  return {
    agendamentos: data.agendamentos || [],
    meta: data.meta || {},
  }
}

export async function listarProfissionais() {
  const data = await api('/api/profissionais')
  return data.dados || []
}

export async function listarServicos() {
  const data = await api('/api/servicos')
  return data.dados || []
}

export async function listarClientes(query = {}) {
  const q = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  const qs = q.toString()
  const path = `/api/clientes${qs ? `?${qs}` : ''}`
  const data = await api(path)
  return {
    clientes: data.clientes || [],
    meta: data.meta || {},
  }
}

export async function buscarClientePorId(clienteId) {
  const data = await api(`/api/clientes/${clienteId}`)
  return data.dados || null
}

export async function criarAgendamento(payload) {
  const data = await api('/api/agendamentos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.dados
}

export async function cancelarAgendamentosDoPeriodo(dataInicio, dataFim) {
  const data = await api('/api/agendamentos/cancelar-periodo', {
    method: 'POST',
    body: JSON.stringify({ dataInicio, dataFim }),
  })
  return data.dados
}

export async function bloquearDiaProfissional(profissionalId, data) {
  const dataResp = await api(`/api/profissionais/${profissionalId}/ausencia`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  })
  return dataResp.dados
}

export async function cancelarAgendamento(id, motivo) {
  const data = await api(`/api/agendamentos/${id}/cancelar`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo: motivo || null }),
  })
  return data.dados
}

export async function remarcarAgendamento(id, novoInicio) {
  const data = await api(`/api/agendamentos/${id}/remarcar`, {
    method: 'PATCH',
    body: JSON.stringify({ novoInicio }),
  })
  return data.dados
}

export async function naoCompareceuAgendamento(id, mensagemWhatsApp) {
  const data = await api(`/api/agendamentos/${id}/nao-compareceu`, {
    method: 'PATCH',
    body: JSON.stringify({ mensagemWhatsApp: mensagemWhatsApp || null }),
  })
  return data.dados
}

export async function criarCliente(payload) {
  const data = await api('/api/clientes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.dados
}

export async function listarFilaEspera(query = {}) {
  const q = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  const qs = q.toString()
  const path = `/api/fila-espera${qs ? `?${qs}` : ''}`
  const data = await api(path)
  return data.dados || []
}

export async function criarFilaEspera(payload) {
  const data = await api('/api/fila-espera', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.dados
}

export async function atualizarStatusFilaEspera(id, status) {
  const data = await api(`/api/fila-espera/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return data.dados
}

export async function listarRankingFidelidade(limite = 5) {
  const data = await api(`/api/fidelidade/ranking?limite=${Number(limite) || 5}`)
  return data.dados || []
}

export async function listarConversas(query = {}) {
  const q = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  const qs = q.toString()
  const path = `/api/conversas${qs ? `?${qs}` : ''}`
  const data = await api(path)
  return data.dados || []
}

export async function buscarConversa(conversaId) {
  const data = await api(`/api/conversas/${conversaId}`)
  return data.dados || null
}

/** Abre conversa do cliente (cria vazia no WhatsApp se ainda não existir). */
export async function abrirConversaPorCliente(clienteId) {
  const data = await api(`/api/conversas/por-cliente/${clienteId}`)
  return data.dados || null
}

export async function enviarMensagemConversa(conversaId, conteudo) {
  const data = await api(`/api/conversas/${conversaId}/mensagens`, {
    method: 'POST',
    body: JSON.stringify({ conteudo }),
  })
  return data.dados
}

export async function assumirConversa(conversaId) {
  const data = await api(`/api/conversas/${conversaId}/assumir`, { method: 'PATCH' })
  return data.dados
}

export async function devolverConversa(conversaId) {
  const data = await api(`/api/conversas/${conversaId}/devolver`, { method: 'PATCH' })
  return data.dados
}

export async function obterSaldoFidelidadeCliente(clienteId) {
  const data = await api(`/api/fidelidade/clientes/${clienteId}`)
  return data.dados || {}
}

export async function resgatarPontosCliente(clienteId) {
  const data = await api(`/api/fidelidade/clientes/${clienteId}/resgatar`, {
    method: 'POST',
  })
  return data.dados
}

export async function obterCaixaAtual() {
  const data = await api('/api/caixa/atual')
  return data.dados || null
}

export async function obterVisaoGeralCaixa(meses = 6) {
  const data = await api(`/api/caixa/visao-geral?meses=${Number(meses) || 6}`)
  return data.dados || null
}

export async function abrirCaixa(payload = {}) {
  const data = await api('/api/caixa/abrir', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.dados
}

export async function fecharCaixa(payload = {}) {
  const data = await api('/api/caixa/fechar', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.dados
}

export async function calcularComissoes(query = {}) {
  const q = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    q.set(k, String(v))
  })
  const qs = q.toString()
  const path = `/api/comissoes${qs ? `?${qs}` : ''}`
  const data = await api(path)
  return data.dados || {}
}

export async function confirmarAgendamento(id) {
  const data = await api(`/api/agendamentos/${id}/confirmar`, { method: 'PATCH' })
  return data.dados
}

export async function confirmarPresenca(id) {
  const data = await api(`/api/agendamentos/${id}/confirmar-presenca`, { method: 'PATCH' })
  return data.dados
}

export async function concluirAgendamento(id, formaPagamento) {
  const data = await api(`/api/agendamentos/${id}/concluir`, {
    method: 'PATCH',
    body: JSON.stringify({ formaPagamento: formaPagamento || null }),
  })
  return data.dados
}
