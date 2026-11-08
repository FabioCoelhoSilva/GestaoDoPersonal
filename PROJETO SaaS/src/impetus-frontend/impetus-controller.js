/* ================================================================= *
 * IMPETUS SAAS - CONTROLADOR GERAL DO MÓDULO DE PARTILHA             *
 * ================================================================= */

import { calcularVolumeTotal, formatarVolumeKG } from './training-metrics.service.js';
import { gerarECompartilharStory } from './impetus-share.service.js';

/**
 * Preenche o card de Stories com os dados reais do treino do aluno e dispara a partilha
 * @param {Array} dadosTreino - Ex: [{ series: 4, repeticoes: 10, carga: 80 }, ...]
 */
export function executarPartilhaTreino(dadosTreino) {
  // 1. Calcula o volume total baseado na ciência do treino
  const volumeCalculado = calcularVolumeTotal(dadosTreino);
  const totalExercicios = dadosTreino ? dadosTreino.length : 0;

  // 2. Atualiza os elementos visuais no DOM do card 9:16
  const elVolume = document.getElementById('val-volume');
  const elExercicios = document.getElementById('val-exercises');

  if (elVolume) {
    elVolume.textContent = formatarVolumeKG(volumeCalculado);
  }
  
  if (elExercicios) {
    elExercicios.textContent = `${totalExercicios} / ${totalExercicios}`;
  }

  // 3. Dispara a geração da imagem e a partilha nativa
  gerarECompartilharStory();
}