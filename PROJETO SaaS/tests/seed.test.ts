import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { assertSafeSeedTarget, seedInitialData } from '../prisma/seed';

const { assertSafeTestDatabaseEnv } = require('../scripts/test-db-safety.cjs') as {
  assertSafeTestDatabaseEnv: (env: NodeJS.ProcessEnv) => string;
};
const testDatabaseUrl = assertSafeTestDatabaseEnv(process.env);
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl });
const suffix = crypto.randomUUID();
const config = {
  personalEmail: `seed-personal-${suffix}@example.test`,
  personalName: 'Personal de Integração',
  students: [
    { email: `seed-student-a-${suffix}@example.test`, name: 'Aluno de Integração A' },
    { email: `seed-student-b-${suffix}@example.test`, name: 'Aluno de Integração B' },
  ],
};

let personalId: string | undefined;

afterAll(async () => {
  if (personalId) {
    await prisma.student.deleteMany({ where: { personalId } });
    await prisma.personal.deleteMany({ where: { id: personalId } });
    await prisma.user.deleteMany({ where: { email: config.personalEmail } });
  }
  await prisma.$disconnect();
});

describe('Prisma seed', () => {
  it('bloqueia bancos remotos por padrão e permite override explícito', () => {
    expect(() => assertSafeSeedTarget('postgresql://user:pass@db.example.com/app'))
      .toThrow(/Seed bloqueado/);
    expect(() => assertSafeSeedTarget('postgresql://user:pass@db.example.com/app', true))
      .not.toThrow();
    expect(() => assertSafeSeedTarget('postgresql://user:pass@localhost/app'))
      .not.toThrow();
  });

  it('cria o personal e alunos vinculados, e é idempotente ao ser executado novamente', async () => {
    const first = await seedInitialData(prisma, config);
    personalId = first.personal.id;
    expect(first.personal).toMatchObject({
      name: config.personalName,
      email: config.personalEmail,
    });
    expect(first.students).toHaveLength(2);

    const second = await seedInitialData(prisma, config);
    expect(second.personal.id).toBe(first.personal.id);
    expect(second.students.map(({ id }) => id)).toEqual(first.students.map(({ id }) => id));

    const persistedStudents = await prisma.student.findMany({
      where: { personalId },
      orderBy: { email: 'asc' },
    });
    expect(persistedStudents).toHaveLength(2);
    expect(persistedStudents.every(({ personalId: owner }) => owner === personalId)).toBe(true);
  });
});
