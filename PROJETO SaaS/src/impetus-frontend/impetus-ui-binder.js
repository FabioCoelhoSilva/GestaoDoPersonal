/* ================================================================= *
 * IMPETUS SAAS - LIGAÇÃO DE EVENTOS DA INTERFACE (UI BINDER)        *
 * ================================================================= */

import { executarPartilhaTreino } from './impetus-controller.js';
import { enviarLeadWhatsApp } from './leads-fast.service.js';

export function inicializarEventosImpetus() {
  // Exemplo de dados de treino simulados vindos da execução do aluno
  const treinoExemplo = [
    { series: 4, repeticoes: 10, carga: 90 }, // ex: Supino Reto
    { series: 4, repeticoes: 12, carga: 120 }, // ex: Agachamento
    { series: 3, repeticoes: 15, carga: 50 }  // ex: Acessório
  ];

  // Botão de Partilhar Story
  const btnShare = document.getElementById('btn-impetus-share');
  if (btnShare) {
    btnShare.addEventListener('click', () => {
      executarPartilhaTreino(treinoExemplo);
    });
  }

  // Botão de Conversão/Lead WhatsApp
  const btnLead = document.getElementById('btn-impetus-lead');
  if (btnLead) {
    btnLead.addEventListener('click', () => {
      enviarLeadWhatsApp("Atleta Impetus", "5584999999999", "Hipertrofia Avançada");
    });
  }
}