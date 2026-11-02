import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

export type SeedConfig = {
  personalEmail: string;
  personalName: string;
  students: Array<{ email: string; name: string }>;
};

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  personalEmail: 'trainer.seed@example.test',
  personalName: 'Personal Trainer de Teste',
  students: [
    { email: 'student.one.seed@example.test', name: 'Aluno de Teste 1' },
    { email: 'student.two.seed@example.test', name: 'Aluno de Teste 2' },
  ],
};

export function assertSafeSeedTarget(
  databaseUrl: string | undefined,
  allowNonLocal = process.env.SEED_ALLOW_NONLOCAL === 'true',
) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada; seed não executado');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL inválida; seed não executado');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL deve apontar para PostgreSQL');
  }

  const host = url.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isLocal && !allowNonLocal) {
    throw new Error(
      'Seed bloqueado para base remota. Defina SEED_ALLOW_NONLOCAL=true após confirmar o destino.',
    );
  }
}

function validateConfig(config: SeedConfig) {
  if (!config.personalName.trim() || !config.personalEmail.includes('@')) {
    throw new Error('Configuração do personal de seed inválida');
  }
  if (config.students.length === 0) {
    throw new Error('O seed deve incluir pelo menos um aluno');
  }
  for (const student of config.students) {
    if (!student.name.trim() || !student.email.includes('@')) {
      throw new Error('Configuração de aluno de seed inválida');
    }
  }
}

async function seedWithTransaction(
  tx: Prisma.TransactionClient,
  config: SeedConfig,
) {
  const user = await tx.user.upsert({
    where: { email: config.personalEmail },
    update: { name: config.personalName, role: 'PERSONAL', provider: 'GOV_BR' },
    create: {
      email: config.personalEmail,
      name: config.personalName,
      role: 'PERSONAL',
      provider: 'GOV_BR',
    },
  });

  const personal = await tx.personal.upsert({
    where: { userId: user.id },
    update: { name: config.personalName },
    create: { userId: user.id, name: config.personalName },
  });

  const students = [];
  for (const seedStudent of config.students) {
    const existing = await tx.student.findFirst({
      where: { personalId: personal.id, email: seedStudent.email },
      select: { id: true },
    });

    const student = existing
      ? await tx.student.update({
          where: { id: existing.id },
          data: { name: seedStudent.name, active: true, anonymizedAt: null },
        })
      : await tx.student.create({
          data: {
            personalId: personal.id,
            name: seedStudent.name,
            email: seedStudent.email,
          },
        });
    students.push(student);
  }

  return {
    personal: { id: personal.id, name: personal.name, email: user.email },
    students: students.map(({ id, name, email }) => ({ id, name, email })),
  };
}

export async function seedInitialData(
  prisma: PrismaClient,
  config: SeedConfig = DEFAULT_SEED_CONFIG,
) {
  validateConfig(config);
  return prisma.$transaction((tx) => seedWithTransaction(tx, config));
}

async function main() {
  assertSafeSeedTarget(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const result = await seedInitialData(prisma);
    console.log(
      `Seed concluído: personal ${result.personal.email}; ${result.students.length} alunos criados/atualizados.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      'Falha ao executar seed:',
      error instanceof Error ? error.message : 'erro desconhecido',
    );
    process.exitCode = 1;
  });
}
