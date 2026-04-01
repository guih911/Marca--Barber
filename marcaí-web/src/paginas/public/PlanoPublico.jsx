import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Crown } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const MARCAI_LOGO = '/logo.svg'
const PUBLIC_PLAN_STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  input[type="text"], input[type="tel"] {
    background: #1a1a1a;
    border: 1px solid #333;
    color: #fff;
    padding: 12px 14px;
    border-radius: 10px;
    width: 100%;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }
  input[type="text"]:focus, input[type="tel"]:focus { border-color: #B8894D; }
  input::placeholder { color: #555; }
  .public-plan-shell {
    max-width: 520px;
    margin: 0 auto;
    padding: 0 16px;
  }
  .public-plan-header {
    background: #0a0a0a;
    border-bottom: 1px solid #222;
    padding: 16px 20px;
  }
  .public-plan-header-shell {
    max-width: 520px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .public-plan-logo {
    width: 124px;
    max-width: 42vw;
    height: auto;
    display: block;
    object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.35));
  }
  .public-plan-header-copy {
    min-width: 0;
  }
  .public-plan-kicker {
    color: #B8894D;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-weight: 600;
  }
  .public-plan-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
  }
  .public-plan-actions {
    display: flex;
    gap: 10px;
  }
  .public-plan-summary-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }
  .public-plan-payment-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }
  @media (max-width: 420px) {
    .public-plan-header-shell {
      flex-direction: column;
      align-items: flex-start;
    }
    .public-plan-logo {
      width: 110px;
      max-width: 48vw;
    }
    .public-plan-card-head,
    .public-plan-summary-row,
    .public-plan-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .public-plan-payment-grid {
      grid-template-columns: 1fr;
    }
  }
`

const FORMAS_PAGAMENTO = [
  { valor: 'DINHEIRO', label: 'Dinheiro' },
  { valor: 'PIX', label: 'Pix' },
  { valor: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { valor: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
]

const formatarPreco = (centavos) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PlanoPublico() {
  const { slug } = useParams()
  const [etapa, setEtapa] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [planos, setPlanos] = useState([])
  const [planoSelecionado, setPlanoSelecionado] = useState(null)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [termos, setTermos] = useState(false)
  const [concluido, setConcluido] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/public/${slug}/planos`)
      .then((r) => r.json())
      .then((d) => {
        if (d.sucesso) {
          setTenant(d.dados.tenant)
          setPlanos(d.dados.planos)
        } else {
          setErro(d.erro?.mensagem || 'Erro ao carregar planos')
        }
      })
      .catch(() => setErro('Erro ao conectar ao servidor'))
      .finally(() => setCarregando(false))
  }, [slug])

  const handleAssinar = async () => {
    if (!termos || !formaPagamento || !nome || !telefone) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await fetch(`${API_URL}/api/public/${slug}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone, planoId: planoSelecionado.id }),
      })
      const d = await r.json()
      if (d.sucesso) {
        setConcluido(true)
      } else {
        setErro(d.erro?.mensagem || 'Erro ao assinar')
      }
    } catch {
      setErro('Erro ao conectar ao servidor')
    } finally {
      setEnviando(false)
    }
  }

  const renderBrandHeader = (subtitle, description) => (
    <div className="public-plan-header">
      <div className="public-plan-header-shell">
        <img
          src={MARCAI_LOGO}
          alt="Marcaí Barber"
          className="public-plan-logo"
        />
        <div className="public-plan-header-copy">
          <p className="public-plan-kicker">
            <Crown size={12} />
            {subtitle}
          </p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, lineHeight: 1.2, marginBottom: 4 }}>
            {tenant?.nome || 'Marcaí Barber'}
          </p>
          <p style={{ color: '#888', fontSize: 13, lineHeight: 1.45 }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #B8894D', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (erro && !tenant) {
    return (
      <div style={{ minHeight: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: '#ef4444', textAlign: 'center' }}>{erro}</p>
      </div>
    )
  }

  if (concluido) {
    return (
      <div style={{ minHeight: '100vh', background: '#111111', padding: '0 0 40px' }}>
        <style>{PUBLIC_PLAN_STYLES}</style>
        {renderBrandHeader('Plano Mensal', 'Sua assinatura foi confirmada e agora faz parte da experiência Marcaí.')}
        <div className="public-plan-shell" style={{ paddingTop: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
          <CheckCircle2 size={64} color="#B8894D" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Assinatura Confirmada!</h2>
          <p style={{ color: '#B8894D', fontSize: 15, marginBottom: 12 }}>
            Você está no plano <strong>{planoSelecionado?.nome}</strong>.
          </p>
          <p style={{ color: '#aaaaaa', fontSize: 14, lineHeight: 1.6 }}>
            O valor de{' '}
            <strong style={{ color: '#B8894D' }}>{formatarPreco(planoSelecionado?.precoCentavos)}</strong>{' '}
            será cobrado no seu próximo atendimento no salão. Até lá! ✂️
          </p>
        </div>
      </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111111', padding: '0 0 40px' }}>
      <style>{PUBLIC_PLAN_STYLES}</style>

      {/* Header */}
      {renderBrandHeader('Plano Mensal', 'Assinatura mensal com créditos para usar quando quiser.')}

      <div className="public-plan-shell">
        {/* Indicador de etapas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0 20px' }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: s < 3 ? 1 : 'auto' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: etapa >= s ? '#B8894D' : '#222',
                  color: etapa >= s ? '#fff' : '#555',
                  border: etapa >= s ? 'none' : '1px solid #333',
                  flexShrink: 0,
                }}
              >
                {etapa > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div style={{ flex: 1, height: 1, background: etapa > s ? '#B8894D' : '#222' }} />
              )}
            </div>
          ))}
        </div>

        {/* ETAPA 1 — Escolher plano */}
        {etapa === 1 && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Escolha seu plano</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Plano mensal com créditos para usar quando quiser</p>

            {planos.length === 0 && (
              <p style={{ color: '#888', textAlign: 'center', paddingTop: 40 }}>Nenhum plano disponível no momento</p>
            )}

            {planos.map((plano) => (
              <div
                key={plano.id}
                onClick={() => setPlanoSelecionado(plano)}
                style={{
                  background: planoSelecionado?.id === plano.id ? '#1a1208' : '#161616',
                  border: `1.5px solid ${planoSelecionado?.id === plano.id ? '#B8894D' : '#2a2a2a'}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                  marginBottom: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div className="public-plan-card-head">
                  <div>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>{plano.nome}</p>
                    {plano.descricao && (
                      <p style={{ color: '#888', fontSize: 13, marginTop: 3 }}>{plano.descricao}</p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p style={{ color: '#B8894D', fontWeight: 800, fontSize: 20 }}>{formatarPreco(plano.precoCentavos)}</p>
                    <p style={{ color: '#666', fontSize: 11 }}>por {plano.cicloDias || 30} dias</p>
                  </div>
                </div>
                {plano.creditos?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plano.creditos.map((c) => (
                      <span
                        key={c.id}
                        style={{
                          background: '#B8894D22',
                          color: '#B8894D',
                          fontSize: 12,
                          padding: '3px 10px',
                          borderRadius: 20,
                        }}
                      >
                        {c.creditos}x {c.servico?.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => planoSelecionado && setEtapa(2)}
              disabled={!planoSelecionado}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: planoSelecionado ? '#B8894D' : '#2a2a2a',
                color: planoSelecionado ? '#fff' : '#555',
                fontWeight: 700,
                fontSize: 16,
                cursor: planoSelecionado ? 'pointer' : 'not-allowed',
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: 'inherit',
              }}
            >
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ETAPA 2 — Dados do cliente */}
        {etapa === 2 && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Seus dados</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Para criar sua assinatura</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>WhatsApp / Telefone</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="public-plan-actions">
              <button
                onClick={() => setEtapa(1)}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  border: '1px solid #333',
                  background: 'transparent',
                  color: '#aaa',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Voltar
              </button>
              <button
                onClick={() => nome.trim() && telefone.trim() && setEtapa(3)}
                disabled={!nome.trim() || !telefone.trim()}
                style={{
                  flex: 2,
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: nome.trim() && telefone.trim() ? '#B8894D' : '#2a2a2a',
                  color: nome.trim() && telefone.trim() ? '#fff' : '#555',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: nome.trim() && telefone.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: 'inherit',
                }}
              >
                Continuar <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Confirmar */}
        {etapa === 3 && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Confirmar assinatura</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>Revise os dados antes de confirmar</p>

            {/* Resumo */}
            <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <p style={{ color: '#888', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo</p>
              <div className="public-plan-summary-row">
                <span style={{ color: '#aaa', fontSize: 14 }}>Plano</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{planoSelecionado?.nome}</span>
              </div>
              <div className="public-plan-summary-row">
                <span style={{ color: '#aaa', fontSize: 14 }}>Nome</span>
                <span style={{ color: '#fff', fontSize: 14 }}>{nome}</span>
              </div>
              <div className="public-plan-summary-row" style={{ marginBottom: 0 }}>
                <span style={{ color: '#aaa', fontSize: 14 }}>Valor</span>
                <span style={{ color: '#B8894D', fontWeight: 700, fontSize: 16 }}>{formatarPreco(planoSelecionado?.precoCentavos)}</span>
              </div>
            </div>

            {/* Preferência de pagamento (informativa, não enviada ao backend) */}
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>Como prefere pagar no dia do atendimento?</p>
            <div className="public-plan-payment-grid">
              {FORMAS_PAGAMENTO.map((fp) => (
                <div
                  key={fp.valor}
                  onClick={() => setFormaPagamento(fp.valor)}
                  style={{
                    padding: '11px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: `1.5px solid ${formaPagamento === fp.valor ? '#B8894D' : '#2a2a2a'}`,
                    background: formaPagamento === fp.valor ? '#1a1208' : '#161616',
                    color: formaPagamento === fp.valor ? '#B8894D' : '#aaa',
                    fontWeight: formaPagamento === fp.valor ? 700 : 400,
                    fontSize: 14,
                    textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {fp.label}
                </div>
              ))}
            </div>

            {/* Termos */}
            <div
              onClick={() => setTermos(!termos)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: `2px solid ${termos ? '#B8894D' : '#444'}`,
                  background: termos ? '#B8894D' : 'transparent',
                  flexShrink: 0,
                  marginTop: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {termos && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
              </div>
              <p style={{ color: '#888', fontSize: 13, lineHeight: '1.5' }}>
                Entendi que o pagamento do plano será cobrado no meu próximo atendimento no salão.
                O plano é pessoal e intransferível, e os créditos têm validade conforme descrito.
              </p>
            </div>

            {erro && (
              <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{erro}</p>
            )}

            <div className="public-plan-actions">
              <button
                onClick={() => setEtapa(2)}
                style={{
                  flex: 1,
                  padding: '13px',
                  borderRadius: 12,
                  border: '1px solid #333',
                  background: 'transparent',
                  color: '#aaa',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Voltar
              </button>
              <button
                onClick={handleAssinar}
                disabled={!termos || !formaPagamento || enviando}
                style={{
                  flex: 2,
                  padding: '13px',
                  borderRadius: 12,
                  border: 'none',
                  background: termos && formaPagamento && !enviando ? '#B8894D' : '#2a2a2a',
                  color: termos && formaPagamento && !enviando ? '#fff' : '#555',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: termos && formaPagamento && !enviando ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {enviando ? 'Aguarde...' : 'Confirmar Assinatura'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
