import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  buscarClientePorId,
  cancelarAgendamento,
  confirmarAgendamento,
  confirmarPresenca,
  concluirAgendamento,
  criarAgendamento,
  criarCliente,
  criarFilaEspera,
  listarAgendamentos,
  listarClientes,
  listarFilaEspera,
  listarProfissionais,
  listarServicos,
  naoCompareceuAgendamento,
  obterSaldoFidelidadeCliente,
  remarcarAgendamento,
  resgatarPontosCliente,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { colors, radius, spacing, statusColors } from '../ui/theme'

const FORMAS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CREDITO', label: 'Cartão crédito' },
  { value: 'DEBITO', label: 'Cartão débito' },
]

function inicioFimDiaLocal(data) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(data)
  fim.setHours(23, 59, 59, 999)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function fmtHora(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDataHora(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function labelStatus(s) {
  const map = {
    AGENDADO: 'Agendado',
    CONFIRMADO: 'Confirmado',
    CONCLUIDO: 'Concluído',
    CANCELADO: 'Cancelado',
    REMARCADO: 'Remarcado',
    NAO_COMPARECEU: 'Não compareceu',
  }
  return map[s] || s
}

function getStatusStyle(status) {
  const cfg = statusColors[status]
  if (!cfg) return { backgroundColor: colors.cardAlt, color: colors.textMuted }
  return { backgroundColor: cfg.bg, color: cfg.text }
}

function gerarHorariosRapidos(dataBase) {
  const inicio = new Date(dataBase)
  inicio.setSeconds(0, 0)
  const agora = new Date()
  const isHoje = inicio.toDateString() === agora.toDateString()
  const base = isHoje ? agora : inicio

  const slot = new Date(base)
  const minutos = slot.getMinutes()
  const ajuste = minutos === 0 || minutos === 30 ? 30 : 30 - (minutos % 30)
  slot.setMinutes(minutos + ajuste)
  slot.setSeconds(0, 0)

  const fimDia = new Date(dataBase)
  fimDia.setHours(21, 0, 0, 0)
  const lista = []
  for (let i = 0; i < 10; i += 1) {
    const candidato = new Date(slot)
    candidato.setMinutes(slot.getMinutes() + i * 30)
    if (candidato > fimDia) break
    lista.push(candidato)
  }

  return lista
}

export default function AgendaScreen({ navigation }) {
  const { logout, user, isPlanoSolo } = useAuth()
  const [dia, setDia] = useState(() => {
    const h = new Date()
    h.setHours(12, 0, 0, 0)
    return h
  })
  const [profissionais, setProfissionais] = useState([])
  const [profissionalId, setProfissionalId] = useState('')
  const [itens, setItens] = useState([])
  const [filaEspera, setFilaEspera] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')

  const [modalConcluir, setModalConcluir] = useState(null)
  const [modalAgendar, setModalAgendar] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState(null)
  const [perfilDetalhes, setPerfilDetalhes] = useState(null)
  const [carregandoPerfilDetalhes, setCarregandoPerfilDetalhes] = useState(false)
  const [erroPerfilDetalhes, setErroPerfilDetalhes] = useState('')
  const [clientes, setClientes] = useState([])
  const [servicos, setServicos] = useState([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteIdNovo, setClienteIdNovo] = useState('')
  const [profissionalIdNovo, setProfissionalIdNovo] = useState('')
  const [servicoIdNovo, setServicoIdNovo] = useState('')
  const [inicioNovo, setInicioNovo] = useState('')
  const [carregandoAgendamento, setCarregandoAgendamento] = useState(false)
  const [salvandoAgendamento, setSalvandoAgendamento] = useState(false)

  const [mostrarCadastroRapido, setMostrarCadastroRapido] = useState(false)
  const [novoClienteNome, setNovoClienteNome] = useState('')
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('')
  const [novoClienteEmail, setNovoClienteEmail] = useState('')
  const [salvandoNovoCliente, setSalvandoNovoCliente] = useState(false)

  const [saldoFidelidade, setSaldoFidelidade] = useState(null)
  const [resgatandoPontos, setResgatandoPontos] = useState(false)

  const query = useMemo(() => {
    const { inicio, fim } = inicioFimDiaLocal(dia)
    const q = {
      inicio,
      fim,
      limite: 80,
      ordem: 'proximosPrimeiro',
      status: 'AGENDADO,CONFIRMADO,CONCLUIDO',
    }
    if (profissionalId) q.profissionalId = profissionalId
    return q
  }, [dia, profissionalId])

  const carregar = useCallback(async () => {
    setMsg('')
    const { agendamentos } = await listarAgendamentos(query)
    setItens(agendamentos)
  }, [query])

  const carregarFila = useCallback(async () => {
    if (isPlanoSolo) {
      setFilaEspera([])
      return
    }
    const { inicio, fim } = inicioFimDiaLocal(dia)
    const itensFila = await listarFilaEspera({ dataInicio: inicio.slice(0, 10), dataFim: fim.slice(0, 10) })
    setFilaEspera(itensFila)
  }, [dia, isPlanoSolo])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const profs = await listarProfissionais()
        if (alive) setProfissionais(profs)
      } catch {
        if (alive) setProfissionais([])
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (profissionais.length === 1 && profissionais[0]?.id) {
      setProfissionalId(profissionais[0].id)
    }
  }, [profissionais])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCarregando(true)
      try {
        await Promise.all([carregar(), carregarFila()])
      } catch (e) {
        if (!cancelled) setMsg(e.message || 'Erro ao carregar agenda.')
      } finally {
        if (!cancelled) setCarregando(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [carregar, carregarFila, isPlanoSolo])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setMsg('')
    try {
      await Promise.all([carregar(), carregarFila()])
    } catch (e) {
      setMsg(e.message || 'Erro ao atualizar.')
    } finally {
      setRefreshing(false)
    }
  }, [carregar, carregarFila, isPlanoSolo])

  const mudarDia = (delta) => {
    const n = new Date(dia)
    n.setDate(n.getDate() + delta)
    setDia(n)
  }

  const dataFmt = useMemo(
    () =>
      dia.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
    [dia]
  )

  const horariosRapidos = useMemo(() => gerarHorariosRapidos(dia), [dia])
  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase()
    if (!termo) return clientes.slice(0, 24)
    return clientes
      .filter((c) => `${c.nome || ''} ${c.telefone || ''}`.toLowerCase().includes(termo))
      .slice(0, 24)
  }, [clientes, buscaCliente])

  const executar = async (fn, mensagemSucesso) => {
    setMsg('')
    try {
      await fn()
      await Promise.all([carregar(), carregarFila()])
      if (mensagemSucesso) setMsg(mensagemSucesso)
    } catch (e) {
      setMsg(e.message || 'Falha na operação.')
    }
  }

  const abrirAgendamentoRapido = useCallback(async () => {
    setModalAgendar(true)
    if (clientes.length > 0 && servicos.length > 0) return
    setCarregandoAgendamento(true)
    try {
      const [dadosClientes, dadosServicos] = await Promise.all([
        listarClientes({ limite: 100 }),
        listarServicos(),
      ])
      setClientes(dadosClientes.clientes || [])
      setServicos(dadosServicos || [])
    } catch (e) {
      setMsg(e.message || 'Erro ao carregar dados para agendar.')
    } finally {
      setCarregandoAgendamento(false)
    }
  }, [clientes.length, servicos.length])

  useEffect(() => {
    if (!modalAgendar) return
    if (!profissionalIdNovo && profissionais[0]?.id) setProfissionalIdNovo(profissionais[0].id)
    if (!servicoIdNovo && servicos[0]?.id) setServicoIdNovo(servicos[0].id)
    if (!inicioNovo && horariosRapidos[0]) setInicioNovo(horariosRapidos[0].toISOString())
  }, [modalAgendar, profissionalIdNovo, profissionais, servicoIdNovo, servicos, inicioNovo, horariosRapidos])

  useEffect(() => {
    if (!clienteIdNovo || !modalAgendar) {
      setSaldoFidelidade(null)
      return
    }
    let ativo = true
    ;(async () => {
      try {
        const dados = await obterSaldoFidelidadeCliente(clienteIdNovo)
        if (ativo) setSaldoFidelidade(dados)
      } catch {
        if (ativo) setSaldoFidelidade(null)
      }
    })()
    return () => {
      ativo = false
    }
  }, [clienteIdNovo, modalAgendar])

  const resetFormAgendamento = () => {
    setClienteIdNovo('')
    setProfissionalIdNovo('')
    setServicoIdNovo('')
    setInicioNovo('')
    setBuscaCliente('')
    setMostrarCadastroRapido(false)
    setNovoClienteNome('')
    setNovoClienteTelefone('')
    setNovoClienteEmail('')
    setSaldoFidelidade(null)
  }

  const fecharAgendamentoRapido = () => {
    setModalAgendar(false)
    resetFormAgendamento()
  }

  const criarNovoClienteRapido = async () => {
    if (!novoClienteNome.trim() || !novoClienteTelefone.trim()) {
      setMsg('Informe nome e telefone para cadastrar cliente.')
      return
    }
    setSalvandoNovoCliente(true)
    setMsg('')
    try {
      const novo = await criarCliente({
        nome: novoClienteNome.trim(),
        telefone: novoClienteTelefone.trim(),
        email: novoClienteEmail.trim() || null,
      })
      const atualizados = await listarClientes({ limite: 100 })
      setClientes(atualizados.clientes || [])
      setClienteIdNovo(novo.id)
      setMostrarCadastroRapido(false)
      setNovoClienteNome('')
      setNovoClienteTelefone('')
      setNovoClienteEmail('')
      setMsg('Cliente cadastrado com sucesso.')
    } catch (e) {
      setMsg(e.message || 'Não foi possível cadastrar cliente.')
    } finally {
      setSalvandoNovoCliente(false)
    }
  }

  const confirmarAgendamentoRapido = async () => {
    if (!clienteIdNovo || !profissionalIdNovo || !servicoIdNovo || !inicioNovo) {
      setMsg('Selecione cliente, profissional, serviço e horário.')
      return
    }
    if (new Date(inicioNovo).getTime() < Date.now()) {
      setMsg('Escolha um horário futuro para criar o agendamento.')
      return
    }

    setSalvandoAgendamento(true)
    setMsg('')
    try {
      await criarAgendamento({
        clienteId: clienteIdNovo,
        profissionalId: profissionalIdNovo,
        servicoId: servicoIdNovo,
        inicio: inicioNovo,
      })
      setModalAgendar(false)
      resetFormAgendamento()
      await Promise.all([carregar(), carregarFila()])
      setMsg('Agendamento criado com sucesso.')
    } catch (e) {
      setMsg(e.message || 'Falha ao criar agendamento.')
    } finally {
      setSalvandoAgendamento(false)
    }
  }

  const enviarParaFilaEspera = async () => {
    if (!clienteIdNovo || !servicoIdNovo || !inicioNovo) {
      setMsg('Selecione cliente, serviço e horário para a lista de espera.')
      return
    }
    await executar(
      () =>
        criarFilaEspera({
          clienteId: clienteIdNovo,
          servicoId: servicoIdNovo,
          profissionalId: profissionalIdNovo || null,
          dataDesejada: inicioNovo,
        }),
      'Cliente adicionado na lista de espera.'
    )
  }

  const abrirChatCliente = (item) => {
    const clienteId = item?.cliente?.id
    if (!clienteId) {
      setMsg('Agendamento sem cliente vinculado.')
      return
    }
    navigation.navigate('ChatTab', {
      clienteId,
      clienteNome: item?.cliente?.nome || '',
      _abrirConversaEm: Date.now(),
    })
  }

  const confirmarCancelamento = (item) => {
    Alert.alert(
      'Cancelar agendamento',
      `Deseja cancelar o horário de ${item?.cliente?.nome || 'cliente'}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar horário',
          style: 'destructive',
          onPress: () =>
            executar(() => cancelarAgendamento(item.id, 'Cancelado pelo app mobile'), 'Agendamento cancelado.'),
        },
      ]
    )
  }

  const confirmarNoShow = (item) => {
    Alert.alert(
      'Não compareceu',
      `Marcar ${item?.cliente?.nome || 'cliente'} como não compareceu?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => executar(() => naoCompareceuAgendamento(item.id), 'Agendamento marcado como não compareceu.'),
        },
      ]
    )
  }

  const remarcarMaisTrinta = async (item) => {
    const atual = new Date(item.inicioEm)
    atual.setMinutes(atual.getMinutes() + 30)
    await executar(() => remarcarAgendamento(item.id, atual.toISOString()), 'Agendamento remarcado em +30 min.')
  }

  const resgatarPontosAtual = async () => {
    if (!clienteIdNovo) return
    setResgatandoPontos(true)
    try {
      await resgatarPontosCliente(clienteIdNovo)
      const dados = await obterSaldoFidelidadeCliente(clienteIdNovo)
      setSaldoFidelidade(dados)
      setMsg('Resgate de fidelidade aplicado.')
    } catch (e) {
      setMsg(e.message || 'Não foi possível resgatar os pontos.')
    } finally {
      setResgatandoPontos(false)
    }
  }

  const abrirDetalhesCliente = async (item) => {
    setModalDetalhes(item)
    setPerfilDetalhes(null)
    setErroPerfilDetalhes('')

    const clienteId = item?.cliente?.id
    if (!clienteId) return

    setCarregandoPerfilDetalhes(true)
    try {
      const perfil = await buscarClientePorId(clienteId)
      setPerfilDetalhes(perfil)
    } catch (e) {
      setErroPerfilDetalhes(e.message || 'Não foi possível carregar o perfil do cliente.')
    } finally {
      setCarregandoPerfilDetalhes(false)
    }
  }

  const renderItem = ({ item }) => {
    const cliente = item.cliente?.nome || 'Cliente'
    const servico = item.servico?.nome || 'Serviço'
    const prof = item.profissional?.nome || ''
    const st = item.status
    const concluido = st === 'CONCLUIDO' || st === 'CANCELADO' || st === 'NAO_COMPARECEU'

    const statusStyle = getStatusStyle(st)

    return (
      <Pressable style={styles.card} onPress={() => abrirDetalhesCliente(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.hora}>{fmtHora(item.inicioEm)}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.backgroundColor }]}>
            <Text style={[styles.badgeText, { color: statusStyle.color }]}>{labelStatus(st)}</Text>
          </View>
        </View>
        <Text style={styles.cliente}>{cliente}</Text>
        <Text style={styles.servico}>{servico}</Text>
        {prof ? <Text style={styles.prof}>{prof}</Text> : null}

        <View style={styles.acoes}>
          <Pressable style={styles.btnChat} onPress={() => abrirChatCliente(item)}>
            <Text style={styles.btnChatText}>Chat</Text>
          </Pressable>

          {!concluido && st === 'AGENDADO' ? (
            <Pressable style={styles.btnConfirmar} onPress={() => executar(() => confirmarAgendamento(item.id), 'Agendamento confirmado.')}>
              <Text style={styles.btnConfirmarText}>Confirmar</Text>
            </Pressable>
          ) : null}

          {!concluido ? (
            <>
              <Pressable style={styles.btnPresenca} onPress={() => executar(() => confirmarPresenca(item.id), 'Presença confirmada.')}>
                <Text style={styles.btnPresencaText}>Presença</Text>
              </Pressable>
              <Pressable style={styles.btnMaisTrinta} onPress={() => remarcarMaisTrinta(item)}>
                <Text style={styles.btnMaisTrintaText}>+30min</Text>
              </Pressable>
              <Pressable style={styles.btnWarn} onPress={() => confirmarNoShow(item)}>
                <Text style={styles.btnWarnText}>Marcar falta</Text>
              </Pressable>
              <Pressable style={styles.btnDanger} onPress={() => confirmarCancelamento(item)}>
                <Text style={styles.btnDangerText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.btnPri} onPress={() => setModalConcluir(item)}>
                <Text style={styles.btnPriText}>Concluir</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </Pressable>
    )
  }

  const pontosAtuais = saldoFidelidade?.saldo?.pontos || 0
  const pontosParaResgate = saldoFidelidade?.config?.pontosParaResgate || 0
  const podeResgatar = pontosParaResgate > 0 && pontosAtuais >= pontosParaResgate

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.saudacao}>Olá, {user?.nome?.split(' ')[0] || '—'}</Text>
          <Text style={styles.subHeader}>Sua agenda operacional</Text>
        </View>
        <Pressable onPress={logout} hitSlop={12}>
          <Text style={styles.sair}>Sair</Text>
        </Pressable>
      </View>

      <View style={styles.navDia}>
        <Pressable style={styles.navBtn} onPress={() => mudarDia(-1)}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.navDiaText}>{dataFmt}</Text>
        <Pressable style={styles.navBtn} onPress={() => mudarDia(1)}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.filtroRow}>
        <Pressable style={styles.agendarRapidoBtn} onPress={abrirAgendamentoRapido}>
          <Text style={styles.agendarRapidoText}>+ Agendar rápido</Text>
        </Pressable>
        {profissionais.length > 1 ? (
          <>
            <Text style={styles.filtroLabel}>Profissional</Text>
            <View style={styles.chips}>
              <Pressable
                style={[styles.chip, !profissionalId && styles.chipOn]}
                onPress={() => setProfissionalId('')}
              >
                <Text style={[styles.chipText, !profissionalId && styles.chipTextOn]}>Todos</Text>
              </Pressable>
              {profissionais.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.chip, profissionalId === p.id && styles.chipOn]}
                  onPress={() => setProfissionalId(p.id)}
                >
                  <Text style={[styles.chipText, profissionalId === p.id && styles.chipTextOn]}>
                    {p.nome}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {!isPlanoSolo ? (
        <View style={styles.filaInfo}>
          <Text style={styles.filaText}>Lista de espera do dia: {filaEspera.length}</Text>
        </View>
      ) : null}

      {msg ? (
        <View style={[
          styles.msgBox,
          /sucesso|conclu[ií]d|confirmad|adicionado|aplicado|criado|remarcado|marcado|cancelado/i.test(msg)
            ? styles.msgSucesso
            : /erro|falha|n[aã]o foi poss[ií]vel|informe|selecione|escolha|cadastre|sem conversa/i.test(msg)
              ? styles.msgErro
              : styles.msgInfo
        ]}>
          <Text style={styles.msgTexto}>{msg}</Text>
        </View>
      ) : null}

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.vazio}>Nenhum agendamento neste dia.</Text>
          }
        />
      )}

      <Modal visible={!!modalConcluir} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Forma de pagamento</Text>
            {FORMAS.map((f) => (
              <Pressable
                key={f.value}
                style={styles.modalOpt}
                onPress={() => {
                  const id = modalConcluir?.id
                  setModalConcluir(null)
                  if (id) executar(() => concluirAgendamento(id, f.value), 'Atendimento concluído.')
                }}
              >
                <Text style={styles.modalOptText}>{f.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.modalCancel}
              onPress={() => {
                const id = modalConcluir?.id
                setModalConcluir(null)
                if (id) executar(() => concluirAgendamento(id, null), 'Atendimento concluído.')
              }}
            >
              <Text style={styles.modalCancelText}>Concluir sem informar</Text>
            </Pressable>
            <Pressable style={styles.modalFechar} onPress={() => setModalConcluir(null)}>
              <Text style={styles.modalFecharText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalDetalhes} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Informações do cliente</Text>
            <Text style={styles.infoLine}>Nome: {modalDetalhes?.cliente?.nome || '-'}</Text>
            <Text style={styles.infoLine}>Telefone: {modalDetalhes?.cliente?.telefone || '-'}</Text>
            <Text style={styles.infoLine}>Tipo de corte: {perfilDetalhes?.tipoCortePreferido || '-'}</Text>
            <Text style={styles.infoLine}>Preferências: {perfilDetalhes?.preferencias || '-'}</Text>
            <Text style={styles.infoLine}>Observações: {perfilDetalhes?.notas || '-'}</Text>
            <Text style={styles.infoLine}>Serviço: {modalDetalhes?.servico?.nome || '-'}</Text>
            <Text style={styles.infoLine}>Profissional: {modalDetalhes?.profissional?.nome || '-'}</Text>
            <Text style={styles.infoLine}>Status: {labelStatus(modalDetalhes?.status || '-')}</Text>
            {carregandoPerfilDetalhes ? (
              <ActivityIndicator color={colors.primary} style={styles.perfilLoader} />
            ) : erroPerfilDetalhes ? (
              <Text style={styles.infoErro}>{erroPerfilDetalhes}</Text>
            ) : (
              <>
                <Text style={styles.modalSectionTitle}>Histórico recente</Text>
                {(perfilDetalhes?.agendamentos || []).slice(0, 6).map((ag) => (
                  <View key={ag.id} style={styles.histItem}>
                    <Text style={styles.histTitle}>
                      {ag.servico?.nome || 'Serviço'} · {ag.profissional?.nome || 'Profissional'}
                    </Text>
                    <Text style={styles.histSub}>
                      {fmtDataHora(ag.inicioEm)} · {labelStatus(ag.status || '-')}
                    </Text>
                  </View>
                ))}
                {!perfilDetalhes?.agendamentos?.length ? (
                  <Text style={styles.histSub}>Sem histórico cadastrado.</Text>
                ) : null}
              </>
            )}
            <Pressable style={styles.modalFechar} onPress={() => setModalDetalhes(null)}>
              <Text style={styles.modalFecharText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={modalAgendar} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.modalAgendarBox]}>
            <Text style={styles.modalTitle}>Agendamento rápido</Text>
            {carregandoAgendamento ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <ScrollView>
                <TextInput
                  value={buscaCliente}
                  onChangeText={setBuscaCliente}
                  placeholder="Buscar cliente por nome ou telefone"
                  placeholderTextColor={colors.textSubtle}
                  style={styles.searchInput}
                />

                <Pressable
                  style={styles.quickClientBtn}
                  onPress={() => setMostrarCadastroRapido((prev) => !prev)}
                >
                  <Text style={styles.quickClientBtnText}>
                    {mostrarCadastroRapido ? 'Fechar cadastro rápido' : '+ Novo cliente rápido'}
                  </Text>
                </Pressable>

                {mostrarCadastroRapido ? (
                  <View style={styles.quickClientBox}>
                    <TextInput
                      value={novoClienteNome}
                      onChangeText={setNovoClienteNome}
                      placeholder="Nome do cliente"
                      placeholderTextColor={colors.textSubtle}
                      style={styles.searchInput}
                    />
                    <TextInput
                      value={novoClienteTelefone}
                      onChangeText={setNovoClienteTelefone}
                      placeholder="Telefone (WhatsApp)"
                      placeholderTextColor={colors.textSubtle}
                      style={styles.searchInput}
                      keyboardType="phone-pad"
                    />
                    <TextInput
                      value={novoClienteEmail}
                      onChangeText={setNovoClienteEmail}
                      placeholder="E-mail (opcional)"
                      placeholderTextColor={colors.textSubtle}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <Pressable
                      style={[styles.modalActionBtn, salvandoNovoCliente && styles.botaoDisabled]}
                      onPress={criarNovoClienteRapido}
                      disabled={salvandoNovoCliente}
                    >
                      {salvandoNovoCliente ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.modalActionText}>Salvar cliente</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                <Text style={styles.modalSectionTitle}>Cliente</Text>
                <View style={styles.chips}>
                  {clientesFiltrados.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.chip, clienteIdNovo === c.id && styles.chipOn]}
                      onPress={() => setClienteIdNovo(c.id)}
                    >
                      <Text style={[styles.chipText, clienteIdNovo === c.id && styles.chipTextOn]}>
                        {c.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {saldoFidelidade?.saldo ? (
                  <View style={styles.fidelidadeBox}>
                    <Text style={styles.fidelidadeTitle}>Fidelidade</Text>
                    <Text style={styles.fidelidadeText}>
                      Pontos: {pontosAtuais} / Resgate: {pontosParaResgate || '-'}
                    </Text>
                    {podeResgatar ? (
                      <Pressable
                        style={[styles.btnSec, resgatandoPontos && styles.botaoDisabled]}
                        onPress={resgatarPontosAtual}
                        disabled={resgatandoPontos}
                      >
                        <Text style={styles.btnSecText}>Resgatar pontos</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <Text style={styles.modalSectionTitle}>Profissional</Text>
                <View style={styles.chips}>
                  {profissionais.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.chip, profissionalIdNovo === p.id && styles.chipOn]}
                      onPress={() => setProfissionalIdNovo(p.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          profissionalIdNovo === p.id && styles.chipTextOn,
                        ]}
                      >
                        {p.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalSectionTitle}>Serviço</Text>
                <View style={styles.chips}>
                  {servicos.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[styles.chip, servicoIdNovo === s.id && styles.chipOn]}
                      onPress={() => setServicoIdNovo(s.id)}
                    >
                      <Text style={[styles.chipText, servicoIdNovo === s.id && styles.chipTextOn]}>
                        {s.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalSectionTitle}>Horário</Text>
                <View style={styles.chips}>
                  {horariosRapidos.map((h) => {
                    const iso = h.toISOString()
                    return (
                      <Pressable
                        key={iso}
                        style={[styles.chip, inicioNovo === iso && styles.chipOn]}
                        onPress={() => setInicioNovo(iso)}
                      >
                        <Text style={[styles.chipText, inicioNovo === iso && styles.chipTextOn]}>
                          {h.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Pressable
                  style={[styles.modalActionBtn, salvandoAgendamento && styles.botaoDisabled]}
                  onPress={confirmarAgendamentoRapido}
                  disabled={salvandoAgendamento}
                >
                  {salvandoAgendamento ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.modalActionText}>Confirmar agendamento</Text>
                  )}
                </Pressable>
                {!isPlanoSolo ? (
                  <Pressable style={styles.modalQueueBtn} onPress={enviarParaFilaEspera}>
                    <Text style={styles.modalQueueBtnText}>Adicionar à lista de espera</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            )}
            <Pressable style={styles.modalFechar} onPress={fecharAgendamentoRapido}>
              <Text style={styles.modalFecharText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  saudacao: { color: colors.text, fontSize: 21, fontWeight: '700' },
  subHeader: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  sair: { color: colors.textMuted, fontSize: 15 },
  navDia: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  navBtnText: { color: colors.primary, fontSize: 22, fontWeight: '300' },
  navDiaText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    minWidth: 140,
    textAlign: 'center',
  },
  filtroRow: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  agendarRapidoBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  agendarRapidoText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  filtroLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  filaInfo: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  filaText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextOn: { color: colors.white, fontWeight: '600' },
  msgBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  msgInfo: {
    backgroundColor: `${colors.info}20`,
    borderColor: `${colors.info}55`,
  },
  msgSucesso: {
    backgroundColor: `${colors.success}20`,
    borderColor: `${colors.success}55`,
  },
  msgErro: {
    backgroundColor: `${colors.danger}20`,
    borderColor: `${colors.danger}55`,
  },
  msgTexto: { color: colors.text, fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  vazio: { color: colors.textSubtle, textAlign: 'center', marginTop: 40, fontSize: 15 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hora: { color: colors.text, fontSize: 22, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cliente: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 10 },
  servico: { color: colors.textMuted, fontSize: 15, marginTop: 4 },
  prof: { color: colors.textSubtle, fontSize: 13, marginTop: 4 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  btnSec: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.cardAlt,
  },
  btnSecText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  btnChat: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${colors.info}20`,
    borderWidth: 1,
    borderColor: `${colors.info}55`,
  },
  btnChatText: { color: colors.info, fontSize: 13, fontWeight: '700' },
  btnConfirmar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${colors.success}20`,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
  },
  btnConfirmarText: { color: colors.success, fontSize: 13, fontWeight: '700' },
  btnPresenca: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${colors.primary}22`,
    borderWidth: 1,
    borderColor: `${colors.primary}66`,
  },
  btnPresencaText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnMaisTrinta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7E22CE22',
    borderWidth: 1,
    borderColor: '#7E22CE66',
  },
  btnMaisTrintaText: { color: '#C084FC', fontSize: 13, fontWeight: '700' },
  btnWarn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.warning,
  },
  btnWarnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.danger,
  },
  btnDangerText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnPri: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  btnPriText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalAgendarBox: {
    maxHeight: '88%',
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  infoLine: { color: colors.text, marginBottom: 6, fontSize: 14 },
  infoErro: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  perfilLoader: { marginVertical: 10 },
  histItem: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  histTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  histSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  modalSectionTitle: {
    color: colors.text,
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  quickClientBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  quickClientBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickClientBox: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  fidelidadeBox: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  fidelidadeTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  fidelidadeText: { color: colors.textMuted, marginTop: 3, fontSize: 12 },
  modalActionBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalActionText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  modalQueueBtn: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalQueueBtnText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  modalOpt: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalOptText: { color: colors.text, fontSize: 16 },
  modalCancel: { paddingVertical: 14 },
  modalCancelText: { color: colors.textMuted, fontSize: 15 },
  modalFechar: { marginTop: 8, alignItems: 'center', paddingVertical: 10 },
  modalFecharText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  botaoDisabled: { opacity: 0.6 },
})
