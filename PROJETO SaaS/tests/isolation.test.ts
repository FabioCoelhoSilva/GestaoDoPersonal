import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getScopedPrisma, logAccess } from '../src/db/scoped-prisma';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { BiMetricsService } from '../src/bi/bi-metrics.service';

// Cliente de SEED (somente testes): acesso sem escopo para montar cenários.
// Rodar contra banco de teste: DATABASE_URL=postgresql://.../saas_test
const seed = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * DAY);
const ahead = (d: number) => new Date(now.getTime() + d * DAY);

async function resetDb() {
  // TRUNCATE não dispara o trigger de access_logs; por isso o reset é permitido aqui.
  await seed.$executeRawUnsafe(`
    TRUNCATE "access_logs", "consent_grants", "exams", "workouts", "extra_payments",
      "payment_parcels", "contracts", "leads", "students", "personals", "users"
    RESTART IDENTITY CASCADE`);
}

async function tenant(label: string) {
  const user = await seed.user.create({
    data: { email: `${label}@teste.com`, name: label, role: 'PERSONAL', provider: 'GOV_BR' },
  });
  const personal = await seed.personal.create({ data: { userId: user.id, name: label } });
  return { user, personal };
}

async function student(personalId: string, label: string) {
  return seed.student.create({
    data: { personalId, name: `aluno-${label}`, email: `${label}@aluno.com` },
  });
}

async function contract(
  personalId: string,
  studentId: string,
  o: {
    status?: 'SIGNED' | 'CANCELLED' | 'EXPIRED';
    start: Date;
    end: Date;
    cancelledAt?: Date;
    monthly?: number;
    cycle?: 'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12';
  },
) {
  const monthly = o.monthly ?? 100;
  return seed.contract.create({
    data: {
      personalId,
      studentId,
      cycle: o.cycle ?? 'MONTHS_3',
      status: o.status ?? 'SIGNED',
      totalAmount: monthly * 3,
      monthlyAmount: monthly,
      startDate: o.start,
      endDate: o.end,
      signedAt: o.start,
      cancelledAt: o.cancelledAt,
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await seed.$disconnect();
});

describe('escopo: entrada', () => {
  it('rejeita personalId vazio ou undefined', () => {
    expect(() => getScopedPrisma('')).toThrow();
    expect(() => getScopedPrisma(undefined as unknown as string)).toThrow();
  });

  it('bloqueia model que não é de tenant', async () => {
    const { personal } = await tenant('a');
    const scoped = getScopedPrisma(personal.id);
    await expect((scoped as any).user.findMany()).rejects.toThrow(/não é de tenant/);
  });

  it('count() sem argumentos funciona', async () => {
    const { personal } = await tenant('a');
    const scoped = getScopedPrisma(personal.id);
    await expect(scoped.student.count()).resolves.toBe(0);
  });
});

describe('escopo: leitura e escrita entre tenants', () => {
  it('findUnique com id de outro tenant retorna null', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const alunoB = await student(b.personal.id, 'b1');

    const scopedA = getScopedPrisma(a.personal.id);
    await expect(scopedA.student.findUnique({ where: { id: alunoB.id } })).resolves.toBeNull();
  });

  it('update com id de outro tenant falha e não altera o registro', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const alunoB = await student(b.personal.id, 'b1');

    const scopedA = getScopedPrisma(a.personal.id);
    await expect(
      scopedA.student.update({ where: { id: alunoB.id }, data: { name: 'invadido' } }),
    ).rejects.toThrow();

    const intacto = await seed.student.findUniqueOrThrow({ where: { id: alunoB.id } });
    expect(intacto.name).toBe('aluno-b1');
  });

  it('delete com id de outro tenant não remove o registro', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const alunoB = await student(b.personal.id, 'b1');

    const scopedA = getScopedPrisma(a.personal.id);
    await expect(scopedA.student.delete({ where: { id: alunoB.id } })).rejects.toThrow();
    await expect(seed.student.findUnique({ where: { id: alunoB.id } })).resolves.not.toBeNull();
  });

  it('create ignora personalId enviado pelo cliente', async () => {
    const a = await tenant('a');
    const b = await tenant('b');

    const scopedA = getScopedPrisma(a.personal.id);
    const criado = await scopedA.student.create({
      data: { personalId: b.personal.id, name: 'x', email: 'x@x.com' },
    });
    expect(criado.personalId).toBe(a.personal.id);
  });

  it('update não consegue mover registro para outro tenant', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const alunoA = await student(a.personal.id, 'a1');

    const scopedA = getScopedPrisma(a.personal.id);
    await scopedA.student.update({
      where: { id: alunoA.id },
      data: { personalId: b.personal.id },
    });
    const depois = await seed.student.findUniqueOrThrow({ where: { id: alunoA.id } });
    expect(depois.personalId).toBe(a.personal.id);
  });
});

describe('integridade no banco', () => {
  it('FK composta rejeita contrato com aluno de outro tenant', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const alunoB = await student(b.personal.id, 'b1');

    await expect(
      seed.contract.create({
        data: {
          personalId: a.personal.id, // tenant A
          studentId: alunoB.id,      // aluno do tenant B
          cycle: 'MONTHS_3',
          totalAmount: 300,
          monthlyAmount: 100,
          startDate: ago(1),
          endDate: ahead(89),
        },
      }),
    ).rejects.toThrow();
  });

  it('CHECK rejeita lead CONVERTED sem convertedStudentId', async () => {
    const a = await tenant('a');
    await expect(
      seed.lead.create({
        data: { personalId: a.personal.id, name: 'l', email: 'l@l.com', status: 'CONVERTED' },
      }),
    ).rejects.toThrow();
  });

  it('access_logs é append-only: UPDATE e DELETE bloqueados', async () => {
    const a = await tenant('a');
    await logAccess({ userId: a.user.id, personalId: a.personal.id, action: 'READ', resource: 'teste' });

    await expect(seed.$executeRawUnsafe(`UPDATE access_logs SET action = 'X'`)).rejects.toThrow(/append-only/);
    await expect(seed.$executeRawUnsafe(`DELETE FROM access_logs`)).rejects.toThrow(/append-only/);
  });
});

describe('dashboard: isolamento', () => {
  it('contagens de um personal não incluem dados de outro', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    await student(a.personal.id, 'a1');
    const alunoB1 = await student(b.personal.id, 'b1');
    await student(b.personal.id, 'b2');
    await seed.paymentParcel.create({
      data: {
        personalId: b.personal.id,
        contractId: (await contract(b.personal.id, alunoB1.id, { start: ago(40), end: ahead(50) })).id,
        amount: 100,
        dueDate: ago(10),
        status: 'PENDING',
      },
    });

    const execA = await new DashboardService(a.personal.id).executive();
    expect(execA.alunos.ativos).toBe(1);
    expect(execA.alunos.inadimplentes).toBe(0);
  });

  it('inadimplência respeita o limite de dias: 6 dias conta, 4 dias não', async () => {
    const a = await tenant('a');
    const s1 = await student(a.personal.id, 'a1');
    const s2 = await student(a.personal.id, 'a2');
    const c1 = await contract(a.personal.id, s1.id, { start: ago(40), end: ahead(50) });
    const c2 = await contract(a.personal.id, s2.id, { start: ago(40), end: ahead(50) });

    await seed.paymentParcel.createMany({
      data: [
        { personalId: a.personal.id, contractId: c1.id, amount: 100, dueDate: ago(6), status: 'PENDING' },
        { personalId: a.personal.id, contractId: c2.id, amount: 100, dueDate: ago(4), status: 'PENDING' },
      ],
    });

    const exec = await new DashboardService(a.personal.id).executive();
    expect(exec.alunos.inadimplentes).toBe(1);
  });

  it('treino sem atualização: sem treino conta como alerta', async () => {
    const a = await tenant('a');
    await student(a.personal.id, 'a1');

    const exec = await new DashboardService(a.personal.id).executive();
    expect(exec.pendencias.treinosSemAtualizacao.total).toBe(1);
  });
});

describe('BI: métricas', () => {
  it('MRR soma apenas contratos vigentes e exclui receita avulsa', async () => {
    const a = await tenant('a');
    const s1 = await student(a.personal.id, 'a1');
    await contract(a.personal.id, s1.id, { start: ago(10), end: ahead(80), monthly: 150 });

    await seed.extraPayment.create({
      data: { personalId: a.personal.id, studentId: s1.id, amount: 999, status: 'CONFIRMED', confirmedAt: now },
    });

    const mrr = await new BiMetricsService(a.personal.id).mrr(now);
    expect(mrr.mrr).toBe('150.00');
    expect(mrr.contratosAtivos).toBe(1);
  });

  it('churn separa cancelamento antecipado de não-renovação e ignora renovados', async () => {
    const a = await tenant('a');
    const s1 = await student(a.personal.id, 's1');
    const s2 = await student(a.personal.id, 's2');
    const s3 = await student(a.personal.id, 's3');
    const s4 = await student(a.personal.id, 's4');

    // Base: vigente no início do período (30 dias atrás)
    await contract(a.personal.id, s1.id, { start: ago(100), end: ahead(10) });
    // Não-renovação: expirou sem novo contrato
    await contract(a.personal.id, s2.id, { status: 'EXPIRED', start: ago(200), end: ago(5) });
    // Expirou, mas renovou dentro da janela
    await contract(a.personal.id, s3.id, { status: 'EXPIRED', start: ago(200), end: ago(10) });
    await contract(a.personal.id, s3.id, { start: ago(9), end: ahead(80) });
    // Cancelamento antecipado
    await contract(a.personal.id, s4.id, {
      status: 'CANCELLED', start: ago(150), end: ahead(30), cancelledAt: ago(3),
    });

    const churn = await new BiMetricsService(a.personal.id).churn(ago(30), now);
    expect(churn.baseNoInicio).toBe(4);
    expect(churn.cancelamentoAntecipado.quantidade).toBe(1);
    expect(churn.naoRenovacao.quantidade).toBe(1);
    expect(churn.churnTotal.quantidade).toBe(2);
    expect(churn.churnTotal.taxa).toBe(0.5);
  });

  it('LTV retorna null abaixo do n mínimo', async () => {
    const a = await tenant('a');
    const s1 = await student(a.personal.id, 'a1');
    await contract(a.personal.id, s1.id, { status: 'EXPIRED', start: ago(200), end: ago(5) });

    const ltv = await new BiMetricsService(a.personal.id).ltvObservado(now);
    expect(ltv.ltv).toBeNull();
  });

  it('LTV de outro tenant não entra no cálculo', async () => {
    const a = await tenant('a');
    const b = await tenant('b');
    const sB = await student(b.personal.id, 'b1');
    const cB = await contract(b.personal.id, sB.id, { status: 'EXPIRED', start: ago(200), end: ago(5) });
    await seed.paymentParcel.create({
      data: { personalId: b.personal.id, contractId: cB.id, amount: 5000, dueDate: ago(100), status: 'CONFIRMED', confirmedAt: ago(100) },
    });

    const ltv = await new BiMetricsService(a.personal.id).ltvObservado(now);
    expect(ltv.alunosNaCoorte).toBe(0);
    expect(ltv.ltv).toBeNull();
  });
});
