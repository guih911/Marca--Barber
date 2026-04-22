import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radius } from '../ui/theme'
import {
  abrirConversaPorCliente,
  assumirConversa,
  buscarConversa,
  devolverConversa,
  enviarMensagemConversa,
  listarConversas,
} from '../api/client'

function fmtHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function iniciais(nome) {
  if (!nome) return 'C'
  const partes = String(nome).trim().split(/\s+/).slice(0, 2)
  return partes.map((p) => p[0]?.toUpperCase() || '').join('') || 'C'
}

export default function ChatScreen({ route }) {
  const [conversas, setConversas] = useState([])
  const [conversaAtual, setConversaAtual] = useState(null)
  const [modoLista, setModoLista] = useState(true)
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const clienteIdDireto = route?.params?.clienteId
  /** Dispara reabertura da mesma conversa ao repetir a navegação (ex.: perfil do cliente de novo). */
  const abrirConversaNavAt = route?.params?._abrirConversaEm

  const carregar = useCallback(async () => {
    setErro('')
    const lista = await listarConversas({ limite: 30 })
    setConversas(lista)
  }, [])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        await carregar()
      } catch (e) {
        if (ativo) setErro(e.message || 'Erro ao carregar conversas.')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [carregar])

  useEffect(() => {
    if (!clienteIdDireto) return

    let ativo = true
    ;(async () => {
      try {
        setErro('')
        const full = await abrirConversaPorCliente(clienteIdDireto)
        if (!ativo || !full?.id) return
        await assumirConversa(full.id).catch(() => {})
        setConversaAtual(full)
        setModoLista(false)
        await carregar()
      } catch (e) {
        if (ativo) setErro(e.message || 'Não foi possível abrir a conversa com este cliente.')
      }
    })()
    return () => {
      ativo = false
    }
  }, [clienteIdDireto, abrirConversaNavAt, carregar])

  const abrirConversa = async (id) => {
    try {
      setErro('')
      await assumirConversa(id).catch(() => {})
      const full = await buscarConversa(id)
      setConversaAtual(full)
      setModoLista(false)
    } catch (e) {
      setErro(e.message || 'Não foi possível abrir conversa.')
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await carregar()
    } catch (e) {
      setErro(e.message || 'Erro ao atualizar.')
    } finally {
      setRefreshing(false)
    }
  }, [carregar])

  const enviar = async () => {
    if (!conversaAtual?.id || !texto.trim()) return
    setEnviando(true)
    try {
      await enviarMensagemConversa(conversaAtual.id, texto.trim())
      setTexto('')
      const atualizado = await buscarConversa(conversaAtual.id)
      setConversaAtual(atualizado)
    } catch (e) {
      setErro(e.message || 'Falha ao enviar mensagem.')
    } finally {
      setEnviando(false)
    }
  }

  const mensagens = useMemo(() => conversaAtual?.mensagens || [], [conversaAtual])
  /** Oculta tool_call/tool_result (só contexto interno da IA). */
  const mensagensVisiveis = useMemo(
    () => mensagens.filter((m) => m.remetente !== 'tool_call' && m.remetente !== 'tool_result'),
    [mensagens]
  )
  const previewConversa = (item) => item?.mensagens?.[0]?.conteudo || 'Sem mensagens'
  const conversasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return conversas
    return conversas.filter((c) =>
      `${c?.cliente?.nome || ''} ${c?.cliente?.telefone || ''}`.toLowerCase().includes(termo)
    )
  }, [conversas, busca])

  const assumirOuDevolver = async () => {
    if (!conversaAtual?.id) return
    try {
      if (conversaAtual.status === 'ESCALONADA') {
        await devolverConversa(conversaAtual.id)
      } else {
        await assumirConversa(conversaAtual.id)
      }
      const atualizado = await buscarConversa(conversaAtual.id)
      setConversaAtual(atualizado)
      await carregar()
    } catch (e) {
      setErro(e.message || 'Falha ao alterar responsável da conversa.')
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {erro ? <Text style={styles.erro}>{erro}</Text> : null}
        {carregando ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {modoLista || !conversaAtual ? (
              <>
                <View style={styles.searchWrap}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar conversa por nome ou telefone"
                    placeholderTextColor={colors.textSubtle}
                    value={busca}
                    onChangeText={setBusca}
                  />
                </View>
                <FlatList
                  data={conversasFiltradas}
                  keyExtractor={(item) => item.id}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                  contentContainerStyle={styles.chatList}
                  renderItem={({ item }) => {
                    const comHumano = item.status === 'ESCALONADA'
                    return (
                    <Pressable
                      style={[styles.chatRow, comHumano && styles.chatRowHumano]}
                      onPress={() => abrirConversa(item.id)}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{iniciais(item.cliente?.nome)}</Text>
                      </View>
                      <View style={styles.chatMiddle}>
                        <View style={styles.chatNomeRow}>
                          <Text style={styles.chatNome} numberOfLines={1}>
                            {item.cliente?.nome || 'Cliente'}
                          </Text>
                          {comHumano ? (
                            <View style={styles.marcaHumanoPill}>
                              <Ionicons name="person" size={11} color={colors.success} />
                              <Text style={styles.marcaHumanoPillText}>Humano</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.chatPreview} numberOfLines={1}>
                          {previewConversa(item)}
                        </Text>
                      </View>
                      <View style={styles.chatRight}>
                        <Text style={styles.chatTime}>{fmtHora(item?.mensagens?.[0]?.criadoEm)}</Text>
                        <View style={[styles.badgePapel, comHumano ? styles.badgePapelHumano : styles.badgePapelIa]}>
                          <Ionicons
                            name={comHumano ? 'person-circle' : 'chatbubbles-outline'}
                            size={11}
                            color={comHumano ? colors.success : colors.textSubtle}
                          />
                          <Text style={comHumano ? styles.badgePapelHumanoText : styles.badgePapelIaText}>
                            {comHumano ? 'Atendimento' : 'IA'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                    )
                  }}
                  ListEmptyComponent={<Text style={styles.vazio}>Sem conversas para exibir.</Text>}
                />
              </>
            ) : (
              <>
                <View style={styles.chatHeader}>
                  <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                      setModoLista(true)
                    }}
                  >
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                  </Pressable>
                  <View style={styles.chatHeaderLeft}>
                    <View style={styles.avatarHeader}>
                      <Text style={styles.avatarHeaderText}>{iniciais(conversaAtual?.cliente?.nome)}</Text>
                    </View>
                    <View>
                      <View style={styles.headerTitleRow}>
                        <Text style={styles.headerNome}>{conversaAtual?.cliente?.nome || 'Conversa'}</Text>
                        {conversaAtual?.status === 'ESCALONADA' ? (
                          <View style={styles.headerBadgeHumano}>
                            <Ionicons name="person" size={12} color={colors.success} />
                            <Text style={styles.headerBadgeHumanoText}>Humano</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.headerSub}>
                        {conversaAtual?.status === 'ESCALONADA' ? 'Cliente aguardando atendente' : 'IA ativa'}
                      </Text>
                    </View>
                  </View>
                  <Pressable style={styles.assumirBtn} onPress={assumirOuDevolver}>
                    <Text style={styles.assumirBtnText}>
                      {conversaAtual?.status === 'ESCALONADA' ? 'Devolver para IA' : 'Assumir'}
                    </Text>
                  </Pressable>
                </View>

                <FlatList
                  data={mensagensVisiveis}
                  keyExtractor={(m) => m.id}
                  contentContainerStyle={styles.msgList}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const r = String(item.remetente || '')

                    if (r === 'sistema') {
                      return (
                        <View style={styles.msgSistemaWrap}>
                          <View style={styles.msgSistemaPill}>
                            <Text style={styles.msgSistemaText}>{item.conteudo}</Text>
                          </View>
                        </View>
                      )
                    }

                    if (r.startsWith('nota_interna:')) {
                      return (
                        <View style={styles.msgNotaWrap}>
                          <View style={styles.msgNotaBox}>
                            <Text style={styles.msgNotaLabel}>Nota interna</Text>
                            <Text style={styles.msgNotaConteudo}>{item.conteudo}</Text>
                            <Text style={styles.msgNotaHora}>{fmtHora(item.criadoEm)}</Text>
                          </View>
                        </View>
                      )
                    }

                    const ehCliente = r === 'cliente'
                    const ehIA = r === 'ia'
                    const ehHumano = r.startsWith('humano:')
                    const doBarbearia = ehIA || ehHumano

                    if (!ehCliente && !doBarbearia) {
                      return (
                        <View style={styles.msgSistemaWrap}>
                          <View style={styles.msgSistemaPill}>
                            <Text style={styles.msgSistemaText}>{item.conteudo}</Text>
                          </View>
                        </View>
                      )
                    }

                    return (
                      <View style={[styles.msgBlock, doBarbearia && styles.msgBlockOut]}>
                        {ehHumano ? (
                          <View style={styles.msgLabelHumanoRow}>
                            <View style={styles.msgHumanoTag}>
                              <Ionicons name="person" size={11} color={colors.success} />
                              <Text style={styles.msgHumanoTagText}>Equipe (humano)</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.msgLabelRow}>
                            {ehCliente ? 'Cliente' : ehIA ? 'IA' : 'Equipe'}
                          </Text>
                        )}
                        <View style={[styles.msgWrap, doBarbearia ? styles.msgWrapOut : styles.msgWrapIn]}>
                          <View
                            style={[
                              styles.msgBubble,
                              ehCliente && styles.msgCliente,
                              ehIA && styles.msgIa,
                              ehHumano && styles.msgHumano,
                            ]}
                          >
                            <Text style={[styles.msgText, ehCliente && styles.msgTextCliente]}>
                              {item.conteudo}
                            </Text>
                            <Text style={[styles.msgTime, ehCliente ? styles.msgTimeCliente : styles.msgTimeBarbearia]}>
                              {fmtHora(item.criadoEm)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )
                  }}
                  ListEmptyComponent={<Text style={styles.vazio}>Sem mensagens nesta conversa.</Text>}
                />

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Mensagem"
                    placeholderTextColor={colors.textSubtle}
                    value={texto}
                    onChangeText={setTexto}
                    editable={!enviando}
                    multiline
                    maxLength={1200}
                  />
                  <Pressable style={[styles.enviarBtn, enviando && styles.disabled]} onPress={enviar} disabled={enviando}>
                    {enviando ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Ionicons name="send" size={18} color={colors.white} />
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  erro: { color: colors.danger, paddingHorizontal: 14, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatList: { paddingVertical: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  /** Conversa com fila humana (escalonada) — fácil de achar na lista. */
  chatRowHumano: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  chatRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chatMiddle: { flex: 1, marginRight: 8 },
  chatNomeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chatNome: { color: colors.text, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  marcaHumanoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  marcaHumanoPillText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  chatPreview: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chatTime: { color: colors.textSubtle, fontSize: 11 },
  badgePapel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgePapelHumano: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  badgePapelHumanoText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  badgePapelIa: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badgePapelIaText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  searchWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bgSoft,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarHeader: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarHeaderText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  headerNome: { color: colors.text, fontWeight: '700', fontSize: 14 },
  headerBadgeHumano: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  headerBadgeHumanoText: { color: colors.success, fontSize: 11, fontWeight: '800' },
  headerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  assumirBtn: {
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  assumirBtnText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  msgList: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  msgBlock: { marginBottom: 10, alignItems: 'flex-start', maxWidth: '100%' },
  msgBlockOut: { alignItems: 'flex-end' },
  msgLabelRow: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
    fontWeight: '600',
  },
  msgLabelHumanoRow: { marginBottom: 4, alignItems: 'flex-end' },
  msgHumanoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  msgHumanoTagText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  msgWrap: { marginBottom: 0, flexDirection: 'row' },
  msgWrapIn: { justifyContent: 'flex-start' },
  msgWrapOut: { justifyContent: 'flex-end' },
  msgBubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 6,
    maxWidth: '86%',
  },
  /** Cliente = recebida (esquerda). */
  msgCliente: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 4,
  },
  /** IA = barbearia (direita), dourado — mesmo eixo do envio. */
  msgIa: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  /** Atendente humano (direita), verde — distingue da IA. */
  msgHumano: { backgroundColor: colors.success, borderTopRightRadius: 4 },
  msgText: { color: colors.white, fontSize: 14, lineHeight: 19 },
  msgTextCliente: { color: colors.text },
  msgTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  msgTimeBarbearia: { color: 'rgba(255,255,255,0.78)' },
  msgTimeCliente: { color: colors.textMuted },
  msgSistemaWrap: { alignItems: 'center', marginBottom: 10 },
  msgSistemaPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '96%',
  },
  msgSistemaText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  msgNotaWrap: { alignItems: 'center', marginBottom: 10 },
  msgNotaBox: {
    backgroundColor: '#2A240E',
    borderWidth: 1,
    borderColor: '#5C4D0E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  msgNotaLabel: { color: colors.warning, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  msgNotaConteudo: { color: '#E5E0C8', fontSize: 13, lineHeight: 18 },
  msgNotaHora: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
  vazio: { color: colors.textSubtle, textAlign: 'center', marginTop: 30 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 14,
    marginTop: 8,
    gap: 8,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 110,
  },
  enviarBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
})
