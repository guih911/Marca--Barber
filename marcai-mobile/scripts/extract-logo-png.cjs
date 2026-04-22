/* Extrai o PNG em base64 de public/logo.svg (o mesmo usado na sidebar do web) */
const fs = require('fs')
const path = require('path')

const svgPath = path.join(__dirname, '../../marcaí-web/public/logo.svg')
const outPath = path.join(__dirname, '../assets/logo-sidebar.png')

const s = fs.readFileSync(svgPath, 'utf8')
const m = s.match(/xlink:href="data:image\/(png|jpeg);base64,([^"]+)"/i) ||
  s.match(/href="data:image\/(png|jpeg);base64,([^"]+)"/i)
if (!m) {
  console.error('Nenhum data:image em base64 encontrado em logo.svg')
  process.exit(1)
}
const buf = Buffer.from(m[2], 'base64')
fs.writeFileSync(outPath, buf)
console.log('OK', outPath, buf.length, 'bytes', m[1])
