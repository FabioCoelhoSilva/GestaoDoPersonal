import { ContractStatus, ExamStatus, LeadStatus, ParcelStatus } from '@prisma/client';
import {
  countTenantRows,
  countTenantRowsByValues,
  selectTenantRows,
  selectTenantRowsByValues,
} from '../db/supabase-rest';
import { BI_RULES } from '../bi/bi-rules';

const DAY_MS = 24 * 60 * 60 * 1000;
const LISTA_MAX = 20; // limite de itens em listas operacionais

type ContractRow = {
  id: string;
  studentId: string;
  cycle: string;
  endDate: string;
};

type StudentRow = { id: string; name: string };
type WorkoutRow = { studentId: string; updatedAt: string };

export class DashboardService {
  private readonly personalId: string;

  constructor(personalId: string) {
    if (!personalId) throw new Error('personalId obrigatório');
    this.personalId = personalId;
  }

  /** Painel executivo: visão operacional em tempo real. */
  async executive(now: Date = new Date()) {
    const cutoffInadimplencia = new Date(now.getTime() - BI_RULES.INADIMPLENCIA_DIAS_PIX * DAY_MS);
    const cutoffTreino = new Date(now.getTime() - BI_RULES.ALERTA_TREINO_SEM_ATUALIZACAO_DIAS * DAY_MS);
    const vencendoAte = new Date(now.getTime() + BI_RULES.CONTRATO_VENCENDO_DIAS * DAY_MS);

    const [alunosAtivos, parcelasVencidas, contratosVencendo, examesPendentes, alunosAtivosComTreino, contagensFunil] =
      await Promise.all([
        countTenantRows('students', this.personalId, { active: 'eq.true', anonymizedAt: 'is.null' }),

        selectTenantRows<{ contractId: string }>('payment_parcels', this.personalId, {
          select: 'contractId',
          status: `in.(${ParcelStatus.PENDING},${ParcelStatus.FAILED})`,
          dueDate: `lt.${cutoffInadimplencia.toISOString()}`,
        }),

        selectTenantRows<ContractRow>('contracts', this.personalId, {
          select: 'id,studentId,cycle,endDate',
          status: `eq.${ContractStatus.SIGNED}`,
          and: `(endDate.gte.${now.toISOString()},endDate.lte.${vencendoAte.toISOString()})`,
          order: 'endDate.asc',
          limit: String(LISTA_MAX),
        }),

        countTenantRows('exams', this.personalId, {
          status: `eq.${ExamStatus.PENDING_REVIEW}`,
        }),

        selectTenantRows<StudentRow>('students', this.personalId, {
          select: 'id,name',
          active: 'eq.true',
          anonymizedAt: 'is.null',
        }),

        Promise.all([
          LeadStatus.NEW,
          LeadStatus.CONTACTED,
          LeadStatus.QUALIFIED,
          LeadStatus.CONVERTED,
          LeadStatus.DISQUALIFIED,
        ].map(async (status) => [
          status,
          await countTenantRows('leads', this.personalId, { status: `eq.${status}` }),
        ] as const)),
      ]);

    const upcomingStudentIds = [...new Set(contratosVencendo.map((contract) => contract.studentId))];
    const alunosDosContratos = await selectTenantRowsByValues<StudentRow>(
      'students',
      this.personalId,
      'id',
      upcomingStudentIds,
      { select: 'id,name' },
    );
    const nomePorAluno = new Map(alunosDosContratos.map((student) => [student.id, student.name]));

    const contractIds = [...new Set(parcelasVencidas.map((parcel) => parcel.contractId))];
    const contratosInadimplentes = await selectTenantRowsByValues<{ studentId: string }>(
      'contracts',
      this.personalId,
      'id',
      contractIds,
      { select: 'studentId' },
    );
    const idsInadimplentes = [...new Set(contratosInadimplentes.map((contract) => contract.studentId))];
    const inadimplentes = await countTenantRowsByValues(
      'students',
      this.personalId,
      'id',
      idsInadimplentes,
      { active: 'eq.true', anonymizedAt: 'is.null' },
    );

    const studentIds = alunosAtivosComTreino.map((student) => student.id);
    const workouts = await selectTenantRowsByValues<WorkoutRow>(
      'workouts',
      this.personalId,
      'studentId',
      studentIds,
      { select: 'studentId,updatedAt', active: 'eq.true', order: 'updatedAt.desc' },
    );
    const latestWorkoutByStudent = new Map<string, Date>();
    for (const workout of workouts) {
      if (!latestWorkoutByStudent.has(workout.studentId)) {
        latestWorkoutByStudent.set(workout.studentId, new Date(workout.updatedAt));
      }
    }

    // Treinos sem atualização: sem treino ativo ou último treino antigo demais
    const semAtualizacao = alunosAtivosComTreino.filter((s) => {
      const ultimo = latestWorkoutByStudent.get(s.id);
      return !ultimo || ultimo < cutoffTreino;
    });

    const porStatus = Object.fromEntries(contagensFunil) as Record<LeadStatus, number>;
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
        itens: contratosVencendo.map((contract) => {
          const studentName = nomePorAluno.get(contract.studentId);
          if (studentName === undefined) {
            throw new Error(`Aluno ${contract.studentId} não encontrado para contrato ${contract.id}`);
          }
          return {
            contratoId: contract.id,
            alunoId: contract.studentId,
            alunoNome: studentName,
            ciclo: contract.cycle,
            fimEm: new Date(contract.endDate),
          };
        }),
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
            ultimaAtualizacao: latestWorkoutByStudent.get(s.id) ?? null,
          })),
        },
      },
    };
  }
}
