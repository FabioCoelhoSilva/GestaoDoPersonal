import { ParcelStatus, Prisma } from '@prisma/client';
import { getScopedPrisma } from '../db/scoped-prisma';
import { BI_RULES } from '../bi/bi-rules';

const DAY_MS = 24 * 60 * 60 * 1000;

function requireTenantId(tenantId: string) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('Relatorio: tenantId obrigatório');
  }
  return tenantId;
}

function normalizeAmount(value: { toFixed: (digits: number) => string } | null) {
  return value?.toFixed(2) ?? '0.00';
}

type ReportPeriod = { from: Date; to: Date };

/**
 * Relatorios e Métricas de Desempenho do Personal Trainer.
 *
 * Integra:
 * - Evolução dos alunos (progress por exercício, execuções de treino, conclusão)
 * - Frequência na agenda (aulas completadas / agendadas / canceladas / taxa)
 * - Resumo financeiro do personal trainer (receitas confirmadas, inadimplência, MRR, churn, LTV)
 */
export class ReportsService {
  private readonly db: ReturnType<typeof getScopedPrisma>;

  constructor(tenantId: string) {
    this.db = getScopedPrisma(requireTenantId(tenantId));
  }

  private async requirePeriod(period: ReportPeriod): Promise<void> {
    if (!(period.from instanceof Date) || !Number.isFinite(period.from.getTime())) {
      throw new Error('Relatorio: período "from" inválido');
    }
    if (!(period.to instanceof Date) || !Number.isFinite(period.to.getTime())) {
      throw new Error('Relatorio: período "to" inválido');
    }
    if (period.from >= period.to) {
      throw new Error('Relatorio: "from" deve ser anterior a "to"');
    }
    if (period.to.getTime() - period.from.getTime() > 366 * DAY_MS) {
      throw new Error('Relatorio: o período máximo é de 366 dias');
    }
  }