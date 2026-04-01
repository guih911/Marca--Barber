/**
 * Utilitário de envio de e-mail via nodemailer.
 * Lê credenciais do .env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 *
 * Se as credenciais não estiverem configuradas, loga aviso e não envia.
 */

const nodemailer = require('nodemailer')

let transporter = null

const obterTransporter = () => {
  if (transporter) return transporter

  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) return null

  const host = process.env.EMAIL_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.EMAIL_PORT || '587', 10)

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })

  return transporter
}

/**
 * Envia um e-mail.
 * @param {{ para: string, assunto: string, html: string, texto?: string }} opcoes
 * @returns {Promise<boolean>} true se enviado, false se credenciais ausentes
 */
const enviarEmail = async ({ para, assunto, html, texto }) => {
  const t = obterTransporter()
  if (!t) {
    console.warn('[Email] Credenciais não configuradas — e-mail NÃO enviado.')
    return false
  }

  const from = process.env.EMAIL_FROM || 'Marcaí <noreply@marcai.com.br>'

  try {
    await t.sendMail({
      from,
      to: para,
      subject: assunto,
      text: texto || assunto,
      html,
    })
    console.log(`[Email] Enviado para ${para} — assunto: "${assunto}"`)
    return true
  } catch (err) {
    console.error(`[Email] Falha ao enviar para ${para}:`, err.message)
    return false
  }
}

/**
 * Monta o HTML padrão de e-mail com a identidade Marcaí.
 * @param {{ titulo: string, corpo: string, botaoTexto?: string, botaoLink?: string }} params
 */
const montarHtmlPadrao = ({ titulo, corpo, botaoTexto, botaoLink }) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
          <!-- Header dourado -->
          <tr>
            <td style="background:#0a0a0a;padding:24px 32px;border-bottom:1px solid #222;">
              <p style="margin:0;color:#B8894D;font-size:22px;font-weight:700;letter-spacing:1px;">✂️ Marcaí</p>
            </td>
          </tr>
          <!-- Corpo -->
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 16px;">${titulo}</h1>
              <div style="color:#aaaaaa;font-size:14px;line-height:1.7;">${corpo}</div>
              ${botaoTexto && botaoLink ? `
              <div style="margin-top:28px;text-align:center;">
                <a href="${botaoLink}"
                   style="background:#B8894D;color:#ffffff;padding:13px 28px;border-radius:10px;
                          text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
                  ${botaoTexto}
                </a>
              </div>` : ''}
              <p style="color:#555;font-size:12px;margin-top:28px;border-top:1px solid #2a2a2a;padding-top:16px;">
                Você está recebendo este e-mail porque uma ação foi realizada em sua conta Marcaí.
                Se não foi você, ignore este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

module.exports = { enviarEmail, montarHtmlPadrao }
