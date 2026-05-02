const { remover } = require('../modulos/clientes/clientes.servico')

async function main() {
  const tenantId = '7b9e3881-8178-4ea7-9494-1773a903248c'; // Get it from find_matheus if needed, but I saw it in find results
  const clientId = '94f6e277-57fa-445a-b838-dfdb856914c5';
  
  try {
    const result = await remover(tenantId, clientId);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
