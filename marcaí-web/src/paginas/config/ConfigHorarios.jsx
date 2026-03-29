import { useState, useEffect } from 'react'
import { Loader2, Save, CheckCircle2 } from 'lucide-react'
import api from '../../servicos/api'
import { diasSemana } from '../../lib/utils'

const ConfigHorarios = () => {
  const [profissionais, setProfissionais] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [horario, setHorario] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    api.get('/api/profissionais').then((r) => {
      setProfissionais(r.dados)
      if (r.dados.length > 0) {
        setSelecionado(r.dados[0])
        setHorario(r.dados[0].horarioTrabalho || {})
      }
    })
  }, [])

  const selecionarProfissional = (p) => {
    setSelecionado(p)
    setHorario(p.horarioTrabalho || {})
  }

  const toggleDia = (dia) => {
    setHorario((h) => ({
      ...h,
      [dia]: {
        ...h[dia],
        ativo: !h[dia]?.ativo,
        inicio: h[dia]?.inicio || '09:00',
        fim: h[dia]?.fim || '18:00',
        intervalos: h[dia]?.intervalos || [],
      },
    }))
  }

  const atualizarCampo = (dia, campo, valor) => {
    setHorario((h) => ({ ...h, [dia]: { ...h[dia], [campo]: valor } }))
  }

  const adicionarIntervalo = (dia) => {
    setHorario((h) => ({
      ...h,
      [dia]: {
        ...h[dia],
        intervalos: [...(h[dia]?.intervalos || []), { inicio: '12:00', fim: '13:00' }],
      },
    }))
  }

  const removerIntervalo = (dia, idx) => {
    setHorario((h) => ({
      ...h,
      [dia]: { ...h[dia], intervalos: h[dia].intervalos.filter((_, i) => i !== idx) },
    }))
  }

  const salvar = async () => {
    if (!selecionado) return

    for (const [diaNum, config] of Object.entries(horario)) {
      if (!config?.ativo) continue
      if (config.inicio >= config.fim) {
        alert(`Horário inválido: o início deve ser anterior ao fim (${diasSemana.find(d => d.numero === Number(diaNum))?.label || diaNum}).`)
        return
      }
      for (const intervalo of config.intervalos || []) {
        if (intervalo.inicio >= intervalo.fim) {
          alert(`Intervalo inválido: o início deve ser anterior ao fim (${diasSemana.find(d => d.numero === Number(diaNum))?.label || diaNum}).`)
          return
        }
      }
    }

    setSalvando(true)
    try {
      await api.patch(`/api/profissionais/${selecionado.id}`, { horarioTrabalho: horario })
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-texto">Horários de Trabalho</h1>
        <p className="text-texto-sec text-sm mt-1">Configure os horários de cada profissional</p>
      </div>

      {/* Seletor de profissional */}
      <div className="flex gap-2 flex-wrap">
        {profissionais.map((p) => (
          <button
            key={p.id}
            onClick={() => selecionarProfissional(p)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selecionado?.id === p.id ? 'bg-primaria text-white' : 'bg-white border border-borda text-texto-sec hover:text-texto'}`}
          >
            {p.nome}
          </button>
        ))}
      </div>

      {selecionado && (
        <div className="bg-white rounded-2xl border border-borda p-6 shadow-sm space-y-4">
          {diasSemana.map((dia) => {
            const config = horario[dia.numero] || { ativo: false }
            return (
              <div key={dia.numero} className={`rounded-xl border p-4 transition-colors ${config.ativo ? 'border-primaria/30 bg-primaria-clara/10' : 'border-borda'}`}>
                <div className="flex items-center gap-4">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDia(dia.numero)}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${config.ativo ? 'bg-primaria' : 'bg-borda'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${config.ativo ? 'left-5' : 'left-0.5'}`} />
                  </button>

                  <span className={`font-medium min-w-20 text-sm ${config.ativo ? 'text-texto' : 'text-texto-sec'}`}>
                    {dia.label}
                  </span>

                  {config.ativo ? (
                    <div className="flex items-center gap-3 flex-wrap flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-texto-sec">Início</span>
                        <input type="time" value={config.inicio || '09:00'} onChange={(e) => atualizarCampo(dia.numero, 'inicio', e.target.value)} className="px-2 py-1 rounded-lg border border-borda text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-texto-sec">Fim</span>
                        <input type="time" value={config.fim || '18:00'} onChange={(e) => atualizarCampo(dia.numero, 'fim', e.target.value)} className="px-2 py-1 rounded-lg border border-borda text-sm" />
                      </div>
                    </div>
                  ) : (
                    <span className="text-texto-sec text-sm">Não trabalha</span>
                  )}
                </div>

                {/* Intervalos */}
                {config.ativo && (
                  <div className="mt-3 pl-16">
                    {config.intervalos?.map((intervalo, idx) => (
                      <div key={idx} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-texto-sec">Intervalo</span>
                        <input type="time" value={intervalo.inicio} onChange={(e) => {
                          const novos = [...config.intervalos]
                          novos[idx] = { ...novos[idx], inicio: e.target.value }
                          atualizarCampo(dia.numero, 'intervalos', novos)
                        }} className="px-2 py-1 rounded border border-borda text-xs" />
                        <span className="text-xs text-texto-sec">às</span>
                        <input type="time" value={intervalo.fim} onChange={(e) => {
                          const novos = [...config.intervalos]
                          novos[idx] = { ...novos[idx], fim: e.target.value }
                          atualizarCampo(dia.numero, 'intervalos', novos)
                        }} className="px-2 py-1 rounded border border-borda text-xs" />
                        <button onClick={() => removerIntervalo(dia.numero, idx)} className="text-perigo text-xs hover:underline">Remover</button>
                      </div>
                    ))}
                    <button onClick={() => adicionarIntervalo(dia.numero)} className="text-xs text-primaria hover:underline">
                      + Adicionar intervalo
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-2">
            {sucesso && <span className="flex items-center gap-1.5 text-sucesso text-sm"><CheckCircle2 size={16} /> Salvo!</span>}
            <button onClick={salvar} disabled={salvando} className="ml-auto bg-primaria hover:bg-primaria-escura disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar horários
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConfigHorarios
