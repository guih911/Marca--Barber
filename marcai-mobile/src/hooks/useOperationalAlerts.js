import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import Constants from 'expo-constants'
import { listarAgendamentos, listarConversas } from '../api/client'

/**
 * No Expo Go + Android (SDK 53+), o bridge de notificações nativas (push/FCM) gera
 * tela vermelha. Mantemos o polling e os badges; notificações locais só fora do Expo Go.
 */
const notificacoesNativasHabilitadas =
  Platform.OS !== 'web' &&
  !(Platform.OS === 'android' && Constants.appOwnership === 'expo')

function carregarExpoNotificacoes() {
  if (!notificacoesNativasHabilitadas) return null
  try {
    return require('expo-notifications')
  } catch (e) {
    console.warn('[useOperationalAlerts] expo-notifications indisponível:', e?.message)
    return null
  }
}

function inicioFimDiaLocal(data) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(data)
  fim.setHours(23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

async function garantirPermissaoNotificacao(Notifications) {
  if (Platform.OS === 'web' || !Notifications) return false

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('operacional', {
        name: 'Operacional',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#B8894D',
      })
    } catch (e) {
      console.warn('[useOperationalAlerts] canal Android:', e?.message)
    }
  }

  const atual = await Notifications.getPermissionsAsync()
  if (atual.granted || atual.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true

  const pedido = await Notifications.requestPermissionsAsync()
  return Boolean(pedido.granted)
}

export default function useOperationalAlerts({ enabled = true } = {}) {
  const [badges, setBadges] = useState({
    pendingAppointments: 0,
    pendingHuman: 0,
  })
  const initializedRef = useRef(false)
  const knownAppointmentIdsRef = useRef(new Set())
  const previousEscalatedIdsRef = useRef(new Set())
  const permissionRef = useRef(false)
  const appStateRef = useRef(AppState.currentState)

  const enviarNotificacao = useCallback(async (title, body) => {
    if (!permissionRef.current) return
    const Notifications = carregarExpoNotificacoes()
    if (!Notifications) return
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      })
    } catch (e) {
      console.warn('[useOperationalAlerts] scheduleNotification:', e?.message)
    }
  }, [])

  const verificar = useCallback(async () => {
    if (!enabled || Platform.OS === 'web') return

    const { inicio, fim } = inicioFimDiaLocal(new Date())
    const [agendaResp, conversas] = await Promise.all([
      listarAgendamentos({
        inicio,
        fim,
        limite: 200,
        ordem: 'proximosPrimeiro',
        status: 'AGENDADO,CONFIRMADO',
      }),
      listarConversas({ limite: 60 }),
    ])

    const agendamentos = agendaResp?.agendamentos || []
    const pendentesConfirmacao = agendamentos.filter((a) => a.status === 'AGENDADO').length
    const escalonadas = (conversas || []).filter((c) => c?.status === 'ESCALONADA')

    setBadges({
      pendingAppointments: pendentesConfirmacao,
      pendingHuman: escalonadas.length,
    })

    if (!notificacoesNativasHabilitadas) {
      if (!initializedRef.current) {
        knownAppointmentIdsRef.current = new Set(agendamentos.map((a) => a.id).filter(Boolean))
        previousEscalatedIdsRef.current = new Set(escalonadas.map((c) => c.id).filter(Boolean))
        initializedRef.current = true
      }
      return
    }

    const currentAppointmentIds = new Set(agendamentos.map((a) => a.id).filter(Boolean))
    const currentEscalatedIds = new Set(escalonadas.map((c) => c.id).filter(Boolean))

    if (!initializedRef.current) {
      knownAppointmentIdsRef.current = currentAppointmentIds
      previousEscalatedIdsRef.current = currentEscalatedIds
      initializedRef.current = true
      return
    }

    const novosAgendamentos = agendamentos.filter((a) => a?.id && !knownAppointmentIdsRef.current.has(a.id))
    if (novosAgendamentos.length > 0) {
      await enviarNotificacao(
        novosAgendamentos.length > 1 ? 'Novos agendamentos' : 'Novo agendamento',
        novosAgendamentos.length > 1
          ? `${novosAgendamentos.length} novos agendamentos foram criados agora.`
          : `Novo agendamento de ${novosAgendamentos[0]?.cliente?.nome || 'cliente'}`
      )
    }

    const novasEscalonadas = escalonadas.filter(
      (c) => c?.id && !previousEscalatedIdsRef.current.has(c.id)
    )
    if (novasEscalonadas.length > 0) {
      await enviarNotificacao(
        novasEscalonadas.length > 1 ? 'Mensagens aguardando humano' : 'Mensagem aguardando humano',
        novasEscalonadas.length > 1
          ? `${novasEscalonadas.length} conversas pedem resposta humana.`
          : `Conversa de ${novasEscalonadas[0]?.cliente?.nome || 'cliente'} precisa de você.`
      )
    }

    knownAppointmentIdsRef.current = currentAppointmentIds
    previousEscalatedIdsRef.current = currentEscalatedIds
  }, [enabled, enviarNotificacao])

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return undefined

    const Notifications = carregarExpoNotificacoes()
    if (Notifications) {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        })
      } catch (e) {
        console.warn('[useOperationalAlerts] setNotificationHandler:', e?.message)
      }
    }

    let intervalId
    let cancelled = false

    ;(async () => {
      if (Notifications) {
        try {
          permissionRef.current = await garantirPermissaoNotificacao(Notifications)
        } catch (e) {
          console.warn('[useOperationalAlerts] permissão:', e?.message)
          permissionRef.current = false
        }
      } else {
        permissionRef.current = false
      }
      if (cancelled) return
      await verificar().catch(() => {})
      intervalId = setInterval(() => {
        if (appStateRef.current !== 'active') return
        verificar().catch(() => {})
      }, 30000)
    })()

    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState
      if (nextState === 'active') {
        verificar().catch(() => {})
      }
    })

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      sub.remove()
    }
  }, [enabled, verificar])

  return badges
}
