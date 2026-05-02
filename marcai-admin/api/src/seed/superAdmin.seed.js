const bcrypt = require('bcryptjs')
const { db } = require('../core/db')

const seedSuperAdmin = async () => {
  const count = await db.superAdmin.count()
  if (count > 0) return

  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD
  const bootstrapName = process.env.ADMIN_BOOTSTRAP_NAME || 'Super Admin'

  if (!bootstrapEmail || !bootstrapPassword) {
    console.warn('[Admin] Nenhum super admin existe e o bootstrap não foi configurado.')
    console.warn('[Admin] Defina ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_PASSWORD para criar o primeiro acesso.')
    return
  }

  const senhaHash = await bcrypt.hash(bootstrapPassword, 10)
  await db.superAdmin.create({
    data: { nome: bootstrapName, email: bootstrapEmail, senhaHash },
  })
  console.log(`[Admin] Super admin inicial criado para ${bootstrapEmail}.`)
}

module.exports = { seedSuperAdmin }
