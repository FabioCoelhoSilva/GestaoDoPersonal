import { CycleDuration, ContractStatus, ParcelStatus } from '@prisma/client';
import {
  countTenantRows,
  selectTenantRows,
  selectTenantRowsByValues,
} from '../db/supabase-rest';
import { BI_RULES } from './bi-rules';

type ContractRef = { id: string; studentId: string; endDate: string };
type ContractRow = ContractRef & {
  status: ContractStatus;
  startDate: string;
  signedAt: string | null;
  cancelledAt: string | null;
  cycle: CycleDuration;
  monthlyAmount: string | number;
};
type AmountRow = { amount: string | number };
type StudentRow = { id: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function rate(part: number, total: number): number | null {
  return total === 0 ? null : Number((part / total).toFixed(4));
}

function toCents(amount: string | number): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) throw new Error('Valor monetário inválido recebido do Supabase');
  return Math.round(value * 100);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function sumAmounts(rows: AmountRow[]): number {
  return rows.reduce((total, row) => total + toCents(row.amount), 0);
}

/**
 * Retorna os ids dos contratos (entre `ended`) que tiveram renovação:
 * novo contrato SIGNED do mesmo aluno iniciando dentro da janela após o fim.
 */
async function renewedContractIds(personalId: string, ended: ContractRef[]): Promise<Set<string>> {
  const renewed = new Set<string>();
  if (ended.length === 0) return renewed;

  const studentIds = [...new Set(ended.map((contract) => contract.studentId))];
  const times = ended.map((contract) => new Date(contract.endDate).getTime());
  const minStart = new Date(Math.min(...times) - DAY_MS);
  const maxStart = new Date(
    Math.max(...times) + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS,
  );

  const candidates = await selectTenantRowsByValues<Pick<ContractRow, 'id' | 'studentId' | 'startDate'>>(
    'contracts',
    personalId,
    'studentId',
    studentIds,
    {
      select: 'id,studentId,startDate',
      signedAt: 'not.is.null',
      and: `(startDate.gte.${minStart.toISOString()},startDate.lte.${maxStart.toISOString()})`,
    },
  );

  for (const contract of ended) {
    const endTime = new Date(contract.endDate).getTime();
    const lo = endTime - DAY_MS;
    const hi = endTime + BI_RULES.JANELA_RENOVACAO_DIAS * DAY_MS;
    const hasNext = candidates.some(
      (candidate) =>
        candidate.studentId === contract.studentId &&
        candidate.id !== contract.id &&
        new Date(candidate.startDate).getTime() >= lo &&
        new Date(candidate.startDate).getTime() <= hi,
    );
    if (hasNext) renewed.add(contract.id);
  }
  return renewed;
}

export class BiMetricsService {
  private readonly personalId: string;

  constructor(personalId: string) {
    if (!personalId) throw new Error('personalId obrigatório');
    this.personalId = personalId;
  }

  /** MRR: soma de monthlyAmount dos contratos SIGNED vigentes na data. Pix avulso fica fora. */
  async mrr(at: Date = new Date()) {
    const contracts = await selectTenantRows<Pick<ContractRow, 'monthlyAmount'>>(
      'contracts',
      this.personalId,
      {
        select: 'monthlyAmount',
        status: `eq.${ContractStatus.SIGNED}`,
        startDate: `lte.${at.toISOString()}`,
        endDate: `gte.${at.toISOString()}`,
      },
    );
    return {
      mrr: formatCents(
        contracts.reduce((total, contract) => total + toCents(contract.monthlyAmount), 0),
      ),
      contratosAtivos: contracts.length,
    };
  }

  /**
   * Churn por contrato no período [from, to].
   * Base: contratos vigentes no início do período.
   * Componentes separados: cancelamento antecipado e não-renovação ao fim do ciclo.
   */
  async churn(from: Date, to: Date) {
    const activeAtStart = await countTenantRows('contracts', this.personalId, {
      signedAt: 'not.is.null',
      startDate: `lte.${from.toISOString()}`,
      endDate: `gte.${from.toISOString()}`,
      or: `(cancelledAt.is.null,cancelledAt.gte.${from.toISOString()})`,
    });

    const cancelados = await countTenantRows('contracts', this.personalId, {
      status: `eq.${ContractStatus.CANCELLED}`,
      signedAt: 'not.is.null',
      startDate: `lte.${from.toISOString()}`,
      and: `(cancelledAt.gte.${from.toISOString()},cancelledAt.lte.${to.toISOString()})`,
    });

    const expiradosNoPeriodo = await selectTenantRows<ContractRef>(
      'contracts',
      this.personalId,
      {
        select: 'id,studentId,endDate',
        status: `eq.${ContractStatus.EXPIRED}`,
        signedAt: 'not.is.null',
        startDate: `lte.${from.toISOString()}`,
        and: `(endDate.gte.${from.toISOString()},endDate.lte.${to.toISOString()})`,
      },
    );
    const renovados = await renewedContractIds(this.personalId, expiradosNoPeriodo);
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
    const [students, contracts] = await Promise.all([
      selectTenantRows<StudentRow>('students', this.personalId, { select: 'id' }),
      selectTenantRows<Pick<ContractRow, 'studentId' | 'status' | 'endDate'>>(
        'contracts',
        this.personalId,
        { select: 'studentId,status,endDate' },
      ),
    ]);

    const contractStateByStudent = new Map<string, { hasContract: boolean; hasCurrent: boolean }>();
    for (const contract of contracts) {
      const state = contractStateByStudent.get(contract.studentId) ?? {
        hasContract: false,
        hasCurrent: false,
      };
      state.hasContract = true;
      if (
        contract.status === ContractStatus.SIGNED &&
        new Date(contract.endDate).getTime() >= at.getTime()
      ) {
        state.hasCurrent = true;
      }
      contractStateByStudent.set(contract.studentId, state);
    }

    const encerrados = students.filter((student) => {
      const state = contractStateByStudent.get(student.id);
      return state?.hasContract && !state.hasCurrent;
    });
    const n = encerrados.length;
    if (n < BI_RULES.LTV_N_MINIMO) {
      return {
        ltv: null,
        alunosNaCoorte: n,
        motivo: `n mínimo de ${BI_RULES.LTV_N_MINIMO} não atingido`,
      };
    }

    const ids = encerrados.map((student) => student.id);
    const cohortIds = new Set(ids);
    const cohortContracts = contracts.filter((contract) => cohortIds.has(contract.studentId));
    const studentIdsWithContracts = [...new Set(cohortContracts.map((contract) => contract.studentId))];
    const contractRows = await selectTenantRowsByValues<{ id: string; studentId: string }>(
      'contracts',
      this.personalId,
      'studentId',
      studentIdsWithContracts,
      { select: 'id,studentId' },
    );
    const paymentContractIds = [...new Set(contractRows.map((contract) => contract.id))];

    const [parcelas, avulsas] = await Promise.all([
      selectTenantRowsByValues<AmountRow>(
        'payment_parcels',
        this.personalId,
        'contractId',
        paymentContractIds,
        { select: 'amount', status: `eq.${ParcelStatus.CONFIRMED}` },
      ),
      selectTenantRowsByValues<AmountRow>(
        'extra_payments',
        this.personalId,
        'studentId',
        ids,
        { select: 'amount', status: `eq.${ParcelStatus.CONFIRMED}` },
      ),
    ]);

    const ltvCents = Math.round((sumAmounts(parcelas) + sumAmounts(avulsas)) / n);
    return { ltv: formatCents(ltvCents), alunosNaCoorte: n };
  }

  /**
   * Retenção por ciclo: dos contratos com ciclo encerrado na janela (fim natural ou cancelamento),
   * quantos foram renovados. Cancelados contam como não retidos.
   */
  async retencao(
    cycle: CycleDuration,
    now: Date = new Date(),
    janelaMeses = BI_RULES.JANELA_RETENCAO_MESES,
  ) {
    const from = addMonths(now, -janelaMeses);
    const encerrados = await selectTenantRows<ContractRef & { status: ContractStatus }>(
      'contracts',
      this.personalId,
      {
        select: 'id,studentId,endDate,status',
        cycle: `eq.${cycle}`,
        signedAt: 'not.is.null',
        or: `(and(endDate.gte.${from.toISOString()},endDate.lte.${now.toISOString()}),and(status.eq.${ContractStatus.CANCELLED},cancelledAt.gte.${from.toISOString()},cancelledAt.lte.${now.toISOString()}))`,
      },
    );

    const naoCancelados = encerrados.filter(
      (contract) => contract.status !== ContractStatus.CANCELLED,
    );
    const renovados = await renewedContractIds(this.personalId, naoCancelados);
    const retidos = naoCancelados.filter((contract) => renovados.has(contract.id)).length;

    return {
      cycle,
      coorte: encerrados.length,
      retidos,
      taxa: rate(retidos, encerrados.length),
    };
  }
}
