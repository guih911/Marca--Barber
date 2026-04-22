import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { buscarClientePorId, criarCliente, listarClientes } from '../api/client'
import { PrimaryButton } from '../ui/components'
import { colors, radius, spacing, typography } from '../ui/theme'

export default function ClientesScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [clientes, setClientes] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [erro, setErro] = useState('')
  const [clienteDetalhe, setClienteDetalhe] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState('')

  const [modalCadastro, setModalCadastro] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNotas, setNovoNotas] = useState('')
  const [enviandoCadastro, setEnviandoCadastro] = useState(false)
  const [erroCadastro, setErroCadastro] = useState('')

  const formatarDataHora = (valor) => {
    if (!valor) return '-'
    const data = new Date(valor)
    if (Number.isNaN(data.getTime())) return '-'
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const carregar = useCallback(async (buscaAtual = '') => {
    const resp = await listarClientes({ limite: 80, busca: buscaAtual || '' })
    setClientes(resp.clientes || [])
  }, [])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        await carregar('')
      } catch (e) {
        if (ativo) setErro(e.message || 'Erro ao carregar clientes.')
      } finally {
        if (ativo) setCarregando(false)
      }
    })()
    return () => {
      ativo = false
    }
  }, [carregar])

  const pesquisar = async () => {
    try {
      setErro('')
      await carregar(busca.trim())
    } catch (e) {
      setErro(e.message || 'Erro na busca.')
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await carregar(busca.trim())
    } catch (e) {
      setErro(e.message || 'Erro ao atualizar.')
    } finally {
      setRefreshing(false)
    }
  }, [carregar, busca])

  const abrirModalCadastro = () => {
    setErroCadastro('')
    setNovoNome('')
    setNovoTelefone('')
    setNovoEmail('')
    setNovoNotas('')
    setModalCadastro(true)
  }

  const salvarNovoCliente = async () => {
    setErroCadastro('')
    const nome = novoNome.trim()
    const telefone = novoTelefone.replace(/\D/g, '').length
      ? novoTelefone.trim()
      : ''
    if (!nome) {
      setErroCadastro('Informe o nome.')
      return
    }
    if (!telefone) {
      setErroCadastro('Informe o telefone (com DDD).')
      return
    }
    const emailTrim = novoEmail.trim()
    setEnviandoCadastro(true)
    try {
      const payload = {
        nome,
        telefone,
        ...(emailTrim ? { email: emailTrim } : {}),
        ...(novoNotas.trim() ? { notas: novoNotas.trim() } : {}),
      }
      await criarCliente(payload)
      setModalCadastro(false)
      await carregar(busca.trim())
    } catch (e) {
      setErroCadastro(e.message || 'Não foi possível cadastrar.')
    } finally {
      setEnviandoCadastro(false)
    }
  }

  const irParaChatDoCliente = (clienteId) => {
    if (!clienteId) return
    setClienteDetalhe(null)
    navigation.navigate('ChatTab', {
      clienteId,
      _abrirConversaEm: Date.now(),
    })
  }

  const abrirDetalhes = async (clienteId) => {
    setErroDetalhe('')
    setCarregandoDetalhe(true)
    setClienteDetalhe({ id: clienteId, nome: 'Carregando...' })
    try {
      const dados = await buscarClientePorId(clienteId)
      setClienteDetalhe(dados)
    } catch (e) {
      setErroDetalhe(e.message || 'Erro ao carregar detalhes do cliente.')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const historico = clienteDetalhe?.agendamentos || []

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Buscar cliente"
          placeholderTextColor="#8a8a8a"
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={pesquisar}
        />
        <Pressable style={styles.btn} onPress={pesquisar}>
          <Text style={styles.btnText}>Buscar</Text>
        </Pressable>
        <Pressable
          style={styles.addIconBtn}
          onPress={abrirModalCadastro}
          hitSlop={8}
          accessibilityLabel="Cadastrar novo cliente"
        >
          <Ionicons name="person-add-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {erro ? <Text style={styles.erro}>{erro}</Text> : null}

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => abrirDetalhes(item.id)}>
              <Text style={styles.nome}>{item.nome}</Text>
              <Text style={styles.sub}>{item.telefone || 'Sem telefone'}</Text>
              <Text style={styles.sub}>{item.email || 'Sem e-mail'}</Text>
              <View style={styles.metricsRow}>
                <Text style={styles.metricTag}>Atendimentos: {item.totalAgendamentos || 0}</Text>
                <Text style={styles.metricTag}>
                  Última visita: {item.ultimaVisita ? formatarDataHora(item.ultimaVisita) : '—'}
                </Text>
              </View>
              {item.tipoCortePreferido ? (
                <Text style={styles.pref}>Corte preferido: {item.tipoCortePreferido}</Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.vazio}>Nenhum cliente encontrado.</Text>}
        />
      )}

      <Modal visible={modalCadastro} transparent animationType="slide" onRequestClose={() => setModalCadastro(false)}>
        <View style={styles.cadSheetOverlay}>
          <Pressable
            style={styles.cadSheetBackdrop}
            onPress={() => !enviandoCadastro && setModalCadastro(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.cadSheetAvoid}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View style={[styles.cadSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              <View style={styles.cadHandle} />
              <View style={styles.cadHeader}>
                <Text style={styles.cadTitle}>Novo cliente</Text>
                <Pressable
                  onPress={() => !enviandoCadastro && setModalCadastro(false)}
                  style={styles.cadClose}
                  hitSlop={10}
                  accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={26} color={colors.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.cadSub}>Nome, telefone com DDD. Demais campos são opcionais.</Text>
              {erroCadastro ? <Text style={styles.cadErroBox}>{erroCadastro}</Text> : null}

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.cadScroll}
              >
                <View style={styles.cadField}>
                  <Text style={styles.cadLabel}>Nome</Text>
                  <TextInput
                    style={styles.cadInput}
                    placeholder="Nome completo"
                    placeholderTextColor={colors.textSubtle}
                    value={novoNome}
                    onChangeText={setNovoNome}
                    editable={!enviandoCadastro}
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.cadField}>
                  <Text style={styles.cadLabel}>Telefone</Text>
                  <TextInput
                    style={styles.cadInput}
                    placeholder="11 99999-9999"
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="phone-pad"
                    value={novoTelefone}
                    onChangeText={setNovoTelefone}
                    editable={!enviandoCadastro}
                  />
                </View>
                <View style={styles.cadField}>
                  <Text style={styles.cadLabel}>
                    E-mail <Text style={styles.cadOpt}>(opcional)</Text>
                  </Text>
                  <TextInput
                    style={styles.cadInput}
                    placeholder="email@exemplo.com"
                    placeholderTextColor={colors.textSubtle}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={novoEmail}
                    onChangeText={setNovoEmail}
                    editable={!enviandoCadastro}
                  />
                </View>
                <View style={styles.cadField}>
                  <Text style={styles.cadLabel}>
                    Observações <Text style={styles.cadOpt}>(opcional)</Text>
                  </Text>
                  <TextInput
                    style={[styles.cadInput, styles.cadInputArea]}
                    placeholder="Anotações internas"
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    value={novoNotas}
                    onChangeText={setNovoNotas}
                    editable={!enviandoCadastro}
                  />
                </View>
              </ScrollView>

              <View style={styles.cadFooter}>
                <PrimaryButton
                  label="Salvar cliente"
                  onPress={salvarNovoCliente}
                  loading={enviandoCadastro}
                  disabled={enviandoCadastro}
                />
                <Pressable
                  onPress={() => !enviandoCadastro && setModalCadastro(false)}
                  style={styles.cadCancel}
                  disabled={enviandoCadastro}
                >
                  <Text style={styles.cadCancelText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!clienteDetalhe} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Perfil do cliente</Text>
            {!carregandoDetalhe && clienteDetalhe?.id ? (
              <Pressable
                style={styles.perfilAbrirConversa}
                onPress={() => irParaChatDoCliente(clienteDetalhe.id)}
                accessibilityLabel="Abrir conversa com o cliente"
              >
                <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
                <Text style={styles.perfilAbrirConversaText}>Abrir conversa</Text>
              </Pressable>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false}>
              {erroDetalhe ? <Text style={styles.erro}>{erroDetalhe}</Text> : null}
              {carregandoDetalhe ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <>
                  <Text style={styles.infoLine}>Nome: {clienteDetalhe?.nome || '-'}</Text>
                  <Text style={styles.infoLine}>Telefone: {clienteDetalhe?.telefone || '-'}</Text>
                  <Text style={styles.infoLine}>E-mail: {clienteDetalhe?.email || '-'}</Text>
                  <Text style={styles.infoLine}>
                    Tipo de corte: {clienteDetalhe?.tipoCortePreferido || '-'}
                  </Text>
                  <Text style={styles.infoLine}>Preferências: {clienteDetalhe?.preferencias || '-'}</Text>
                  <Text style={styles.infoLine}>Observações: {clienteDetalhe?.notas || '-'}</Text>

                  <Text style={styles.sectionTitle}>Histórico recente</Text>
                  {historico.length === 0 ? (
                    <Text style={styles.sub}>Nenhum histórico disponível.</Text>
                  ) : (
                    historico.slice(0, 8).map((ag) => (
                      <View key={ag.id} style={styles.histItem}>
                        <Text style={styles.histTitle}>
                          {ag.servico?.nome || 'Serviço'} · {ag.profissional?.nome || 'Profissional'}
                        </Text>
                        <Text style={styles.sub}>
                          {formatarDataHora(ag.inicioEm)} · {ag.status || '-'}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>

            <Pressable style={styles.modalClose} onPress={() => setClienteDetalhe(null)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    paddingTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addIconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnText: { color: colors.white, fontWeight: '700' },
  erro: { color: colors.danger, paddingHorizontal: 12, marginTop: 8 },
  cadSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  cadSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cadSheetAvoid: { width: '100%' },
  cadSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '88%',
    paddingTop: 8,
    paddingHorizontal: spacing.lg,
  },
  cadHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  cadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cadTitle: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  cadClose: { padding: 4, marginRight: -4 },
  cadSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  cadErroBox: {
    color: colors.danger,
    fontSize: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: spacing.md,
  },
  cadScroll: { paddingBottom: spacing.sm, flexGrow: 1 },
  cadField: { marginBottom: spacing.md },
  cadLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  cadOpt: { color: colors.textSubtle, fontWeight: '500' },
  cadInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  cadInputArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  cadFooter: { marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  cadCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cadCancelText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  nome: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, marginTop: 4, ...typography.caption },
  pref: { color: colors.primary, marginTop: 6, fontSize: 12, fontWeight: '600' },
  metricsRow: { marginTop: 8, gap: 4 },
  metricTag: {
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  vazio: { color: colors.textSubtle, textAlign: 'center', marginTop: 30 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBox: {
    maxHeight: '86%',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  perfilAbrirConversa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  perfilAbrirConversaText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  infoLine: { color: colors.text, fontSize: 14, marginBottom: 6 },
  sectionTitle: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: spacing.sm, marginBottom: 8 },
  histItem: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  histTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  modalClose: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCloseText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
})
