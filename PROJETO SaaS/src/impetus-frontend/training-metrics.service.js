/* ================================================================= *
 * IMPETUS SAAS - MOTOR DE CÁLCULO DE MÉTRICAS DE TREINO              *
 * ================================================================= */

/**
 * Calcula o volume total de um exercício ou sessão completa
 * @param {Array} exercicios - Lista de exercícios [{ series, repeticoes, carga }]
 * @returns {number} Volume total em quilogramas (kg)
 */
export function calcularVolumeTotal(exercicios) {
  if (!Array.isArray(exercicios) || exercicios.length === 0) return 0;

  return exercicios.reduce((totalAcumulado, ex) => {
    const series = Number(ex.series) || 0;
    const repeticoes = Number(ex.repeticoes) || 0;
    const carga = Number(ex.carga) || 0;

    return totalAcumulado + (series * repeticoes * carga);
  }, 0);
}

/**
 * Formata o valor numérico para o padrão visual do Dashboard / Stories
 */
export function formatarVolumeKG(volume) {
  return volume.toLocaleString('pt-BR') + ' kg';
}