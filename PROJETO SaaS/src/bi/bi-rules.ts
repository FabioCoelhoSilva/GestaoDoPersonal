// Regras de negócio aprovadas para a Fase 7 (Dashboards e BI).
// Alterar aqui muda o cálculo de todos os painéis.

export const BI_RULES = {
  // Inadimplência: parcela Pix PENDING vencida há mais de N dias
  INADIMPLENCIA_DIAS_PIX: 5,

  // Treino sem atualização: alerta após N dias sem atualizar o treino ativo
  ALERTA_TREINO_SEM_ATUALIZACAO_DIAS: 30,

  // Contratos a vencer: janela de alerta de renovação
  CONTRATO_VENCENDO_DIAS: 30,

  // Renovação: novo contrato SIGNED do mesmo aluno iniciando até N dias após o fim do ciclo.
  // Premissa técnica (não definida pelo cliente): confirmar.
  JANELA_RENOVACAO_DIAS: 30,

  // Janela padrão de retenção por ciclo
  JANELA_RETENCAO_MESES: 12,

  // Abaixo deste número de alunos em coorte, LTV não é exibido
  LTV_N_MINIMO: 10,
} as const;
