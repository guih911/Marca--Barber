const normalizarConfigMeta = (configWhatsApp) => {
  const cfg = configWhatsApp && typeof configWhatsApp === 'object' ? configWhatsApp : {}
  const accessToken =
    cfg.token ||
    cfg.accessToken ||
    cfg.permanentToken ||
    cfg.whatsappToken ||
    null
  const phoneNumberId =
    cfg.phoneNumberId ||
    cfg.numeroId ||
    cfg.businessPhoneNumberId ||
    cfg.whatsappPhoneNumberId ||
    null
  const graphVersion = cfg.graphVersion || 'v22.0'
  return { accessToken, phoneNumberId, graphVersion }
}

const enviarMensagemMeta = async ({ configWhatsApp, para, texto }) => {
  const { accessToken, phoneNumberId, graphVersion } = normalizarConfigMeta(configWhatsApp)
  if (!accessToken || !phoneNumberId) {
    return { enviado: false, motivo: 'Meta não configurado para este tenant' }
  }

  const body = {
    messaging_product: 'whatsapp',
    to: para,
    type: 'text',
    text: { body: String(texto || '').slice(0, 4096) },
  }

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const erro = data?.error?.message || `Falha Meta (${response.status})`
    throw new Error(erro)
  }

  return { enviado: true, provider: data }
}

module.exports = {
  normalizarConfigMeta,
  enviarMensagemMeta,
}
