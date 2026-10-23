import { ContractStatus, ExamStatus, LeadStatus, ParcelStatus } from '@prisma/client';
import { getScopedPrisma } from '../db/scoped-prisma';
import { BI_RULES } from '../bi/bi-rules';

type Db = ReturnType<typeof getScopedPrisma>;

const DAY_MS = 24 * 60 * 60 * 1000;
const LISTA_MAX = 20; // limite de itens em listas operacionais

export class DashboardService {
  private db: Db;

  constructor(personalId: string) {
    this.db = getScopedPrisma(personalId); // escopo obrigatório, vindo do contexto autenticado
  }

  /** Painel executivo: visão operacional em tempo real. */
  async executive(now: Date = new Date()) {
    const cutoffInadimplencia = new Date(now.getTime() - BI_RULES.INADIMPLENCIA_DIAS_PIX * DAY_MS);
    const cutoffTreino = new Date(now.getTime() - BI_RULES.ALERTA_TREINO_SEM_ATUALIZACAO_DIAS * DAY_MS);
    const vencendoAte = new Date(now.getTime() + BI_RULES.CONTRATO_VENCENDO_DIAS * DAY_MS);

    const [alunosAtivos, parcelasVencidas, contratosVencendo, funil, examesPendentes, alunosAtivosComTreino] =
      await Promise.all([
        this.db.student.count({ where: { active: true, anonymizedAt: null } }),

        this.db.paymentParcel.findMany({
          where: {
            status: { in: [ParcelStatus.PENDING, ParcelStatus.FAILED] },
            dueDate: { lt: cutoffInadimplencia },
          },
          select: { contract: { select: { studentId: true } } },
        }),

        this.db.contract.findMany({
          where: {
            status: ContractStatus.SIGNED,
            endDate: { gte: now, lte: vencendoAte },
          },
          orderBy: { endDate: 'asc' },
          take: LISTA_MAX,
          select: {
            id: true,
            cycle: true,
            endDate: true,
            student: { select: { id: true, name: true } },
          },
        }),

        this.db.lead.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),

        this.db.exam.count({ where: { status: ExamStatus.PENDING_REVIEW } }),

        this.db.student.findMany({
          where: { active: true, anonymizedAt: null },
          select: {
            id: true,
            name: true,
            workouts: {
              where: { active: true },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { updatedAt: true },
            },
          },
        }),
      ]);

    // Inadimplentes: alunos ativos com ao menos uma parcela Pix vencida além do limite
    const idsInadimplentes = [...new Set(parcelasVencidas.map((p) => p.contract.studentId))];
    const inadimplentes = await this.db.student.count({
      where: { active: true, anonymizedAt: null, id: { in: idsInadimplentes } },
    });

    // Treinos sem atualização: sem treino ativo ou último treino antigo demais
    const semAtualizacao = alunosAtivosComTreino.filter((s) => {
      const ultimo = s.workouts[0]?.updatedAt;
      return !ultimo || ultimo < cutoffTreino;
    });

    const porStatus = Object.fromEntries(funil.map((f) => [f.status, f._count._all])) as Record<LeadStatus, number>;
    const count = (s: LeadStatus) => porStatus[s] ?? 0;

    return {
      alunos: {
        ativos: alunosAtivos,
        inadimplentes,
        adimplentes: alunosAtivos - inadimplentes,
      },
      contratosVencendo: {
        janelaDias: BI_RULES.CONTRATO_VENCENDO_DIAS,
        total: contratosVencendo.length,
        itens: contratosVencendo.map((c) => ({
          contratoId: c.id,
          alunoId: c.student.id,
          alunoNome: c.student.name,
          ciclo: c.cycle,
          fimEm: c.endDate,
        })),
      },
      funilLeads: {
        abertos: count(LeadStatus.NEW) + count(LeadStatus.CONTACTED) + count(LeadStatus.QUALIFIED),
        convertidos: count(LeadStatus.CONVERTED),
        perdidos: count(LeadStatus.DISQUALIFIED),
      },
      pendencias: {
        examesAguardandoValidacao: examesPendentes, // só contagem: sem conteúdo de saúde
        treinosSemAtualizacao: {
          diasLimite: BI_RULES.ALERTA_TREINO_SEM_ATUALIZACAO_DIAS,
          total: semAtualizacao.length,
          itens: semAtualizacao.slice(0, LISTA_MAX).map((s) => ({
            alunoId: s.id,
            alunoNome: s.name,
            ultimaAtualizacao: s.workouts[0]?.updatedAt ?? null,
          })),
        },
      },
    };
  }
}
