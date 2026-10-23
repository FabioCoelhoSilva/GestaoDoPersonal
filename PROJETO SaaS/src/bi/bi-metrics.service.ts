import { CycleDuration, ContractStatus, ParcelStatus, Prisma } from '@prisma/client';
import { getScopedPrisma } from '../db/scoped-prisma';
import { BI_RULES } from './bi-rules';

type Db = ReturnType<typeof getScopedPrisma>;
type ContractRef = { id: string; studentId: string; endDate: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function rate(part: number, total: number): number | null {
  return total === 0 ? null : Number((part / total).toFixed(4));
}

/**
 * Retorna os ids dos contratos (entre `ended`) que tiveram renovação:
 * novo contrato SIGNED do mesmo aluno iniciando dentro da janela após o fim.
 */
async function renewedContractIds(db: Db, ended: ContractRef[]): Promise<Set<string>> {
  const renewed = new Set<string>();
  if (ended.length === 0) return renewed;

  const studentIds = [...new Set(ended.map((c) => c.studentId))];
  const times = ended.map((c) => c.endDate.getTime());
  const minStart = new Date(Math.min(...times) - DAY_MS);
  const maxStart = new Date(Math.max(...times) + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS);

  const candidates = await db.contract.findMany({
    where: {
      studentId: { in: studentIds },
      signedAt: { not: null },
      startDate: { gte: minStart, lte: maxStart },
    },
    select: { id: true, studentId: true, startDate: true },
  });

  for (const c of ended) {
    const lo = c.endDate.getTime() - DAY_MS;
    const hi = c.endDate.getTime() + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS;
    const hasNext = candidates.some(
      (n) =>
        n.studentId === c.studentId &&
        n.id !== c.id &&
        n.startDate.getTime() >= lo &&
        n.startDate.getTime() <= hi,
    );
    if (hasNext) renewed.add(c.id);
  }
  return renewed;
}

export class BiMetricsService {
  private db: Db;

  constructor(personalId: string) {
    this.db = getScopedPrisma(personalId); // escopo obrigatório, vindo do contexto autenticado
  }

  /** MRR: soma de monthlyAmount dos contratos SIGNED vigentes na data. Pix avulso fica fora. */
  async mrr(at: Date = new Date()) {
    const agg = await this.db.contract.aggregate({
      where: {
        status: ContractStatus.SIGNED,
        startDate: { lte: at },
        endDate: { gte: at },
      },
      _sum: { monthlyAmount: true },
      _count: { _all: true },
    });
    return {
      mrr: (agg._sum.monthlyAmount ?? new Prisma.Decimal(0)).toFixed(2),
      contratosAtivos: agg._count._all,
    };
  }

  /**
   * Churn por contrato no período [from, to].
   * Base: contratos vigentes no início do período.
   * Componentes separados: cancelamento antecipado e não-renovação ao fim do ciclo.
   */
  async churn(from: Date, to: Date) {
    const activeAtStart = await this.db.contract.count({
      where: {
        signedAt: { not: null },
        startDate: { lte: from },
        endDate: { gte: from },
        OR: [{ cancelledAt: null }, { cancelledAt: { gte: from } }],
      },
    });

    const cancelados = await this.db.contract.count({
      where: {
        status: ContractStatus.CANCELLED,
        signedAt: { not: null },
        startDate: { lte: from },
        cancelledAt: { gte: from, lte: to },
      },
    });

    const expiradosNoPeriodo = await this.db.contract.findMany({
      where: {
        status: ContractStatus.EXPIRED,
        signedAt: { not: null },
        startDate: { lte: from },
        endDate: { gte: from, lte: to },
      },
      select: { id: true, studentId: true, endDate: true },
    });
    const renovados = await renewedContractIds(this.db, expiradosNoPeriodo);
    const naoRenovados = expiradosNoPeriodo.length - renovados.size;

    const total = cancelados + naoRenovados;
    return {
      baseNoInicio: activeAtStart,
      cancelamentoAntecipado: { quantidade: cancelados, taxa: rate(cancelados, activeAtStart) },
      naoRenovacao: { quantidade: naoRenovados, taxa: rate(naoRenovados, activeAtStart) },
      churnTotal: { quantidade: total, taxa: rate(total, activeAtStart) },
    };
  }

  /**
   * LTV observado: receita CONFIRMED (parcelas + avulsas) dos alunos sem contrato vigente
   * (coortes encerradas), dividida pelo número desses alunos. Não projeta churn.
   */
  async ltvObservado(at: Date = new Date()) {
    const encerrados = await this.db.student.findMany({
      where: {
        contracts: {
          some: {},
          none: { status: ContractStatus.SIGNED, endDate: { gte: at } },
        },
      },
      select: { id: true },
    });
    const n = encerrados.length;
    if (n < BI_RULES.LTV_N_MINIMO) {
      return { ltv: null, alunosNaCoorte: n, motivo: `n mínimo de ${BI_RULES.LTV_N_MINIMO} não atingido` };
    }

    const ids = encerrados.map((s) => s.id);
    const [parcelas, avulsas] = await Promise.all([
      this.db.paymentParcel.aggregate({
        where: { status: ParcelStatus.CONFIRMED, contract: { studentId: { in: ids } } },
        _sum: { amount: true },
      }),
      this.db.extraPayment.aggregate({
        where: { status: ParcelStatus.CONFIRMED, studentId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);

    const receita = (parcelas._sum.amount ?? new Prisma.Decimal(0)).plus(
      avulsas._sum.amount ?? new Prisma.Decimal(0),
    );
    return { ltv: receita.dividedBy(n).toFixed(2), alunosNaCoorte: n };
  }

  /**
   * Retenção por ciclo: dos contratos com ciclo encerrado na janela (fim natural ou cancelamento),
   * quantos foram renovados. Cancelados contam como não retidos.
   */
  async retencao(cycle: CycleDuration, now: Date = new Date(), janelaMeses = BI_RULES.JANELA_RETENCAO_MESES) {
    const from = addMonths(now, -janelaMeses);

    const encerrados = await this.db.contract.findMany({
      where: {
        cycle,
        signedAt: { not: null },
        OR: [
          { endDate: { gte: from, lte: now } },
          { status: ContractStatus.CANCELLED, cancelledAt: { gte: from, lte: now } },
        ],
      },
      select: { id: true, studentId: true, endDate: true, status: true },
    });

    const naoCancelados = encerrados.filter((c) => c.status !== ContractStatus.CANCELLED);
    const renovados = await renewedContractIds(this.db, naoCancelados);
    const retidos = naoCancelados.filter((c) => renovados.has(c.id)).length;

    return {
      cycle,
      coorte: encerrados.length,
      retidos,
      taxa: rate(retidos, encerrados.length),
    };
  }
}
