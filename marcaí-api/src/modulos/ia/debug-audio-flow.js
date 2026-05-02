const vozServico = require('./voz.servico');
const configIA = require('../../config/ia');
const fs = require('fs');

async function debug() {
  console.log('--- TESTE DE ESTRESSE: FLUXO DE ÁUDIO ---');
  console.log('1. Verificando Configurações...');
  console.log('   OpenAI API Key:', configIA.apiKey ? 'CONFIGURADA' : 'FALTANDO');
  console.log('   ElevenLabs Voice ID:', configIA.elevenLabsVoiceId);

  // Tentativa de síntese
  console.log('\n2. Testando Síntese (ElevenLabs)...');
  try {
    const audio = await vozServico.sintetizarAudio('Oi, teste de áudio do Don Barber.');
    if (audio?.buffer) {
      console.log('   SUCESSO: Áudio sintetizado com', audio.buffer.length, 'bytes');
    } else {
      console.log('   FALHA: Síntese retornou nulo');
    }
  } catch (err) {
    console.error('   ERRO NA SÍNTESE:', err.message);
  }

  // Se tiver um arquivo de áudio de teste local, poderíamos testar transcrição.
  // Como não temos, vamos apenas validar se a função transcreverAudio existe e o client OpenAI está ok.
  console.log('\n3. Verificando Transcritor (Whisper)...');
  if (vozServico.transcreverAudio) {
    console.log('   SUCESSO: Função transcreverAudio pronta');
  } else {
    console.log('   FALHA: Função transcreverAudio NÃO ENCONTRADA');
  }

  process.exit(0);
}

debug();
