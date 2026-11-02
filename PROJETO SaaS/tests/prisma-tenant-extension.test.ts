import { describe, expect, it } from 'vitest';
import { getScopedPrisma } from '../src/db/scoped-prisma';

describe('tenant-scoped Prisma client boundary', () => {
  it('requires a non-empty authenticated tenant id', () => {
    expect(() => getScopedPrisma('')).toThrow(/tenantId obrigatório/);
  });

  it('blocks raw SQL, transaction and extension escape hatches', () => {
    const scoped = getScopedPrisma('tenant-test');

    expect(() => scoped.$queryRawUnsafe('SELECT 1')).toThrow(/indisponível/);
    expect(() => scoped.$executeRawUnsafe('DELETE FROM students')).toThrow(/indisponível/);
    expect(() => scoped.$transaction([])).toThrow(/indisponível/);
    expect(() => scoped.$extends({})).toThrow(/indisponível/);
  });

  it('rejects nested relation writes that would bypass model-level tenant filters', async () => {
    const scoped = getScopedPrisma('tenant-test');

    await expect(
      scoped.student.create({
        data: {
          name: 'Student',
          email: 'student@example.invalid',
          personal: { connect: { id: 'tenant-test' } },
          user: { connect: { id: 'user-test' } },
        },
      }),
    ).rejects.toThrow(/escrita relacional aninhada não permitida/);
  });

  it('rejects a workout relation that attempts to connect another tenant as owner', async () => {
    const scoped = getScopedPrisma('tenant-test');

    await expect(
      scoped.workout.create({
        data: {
          title: 'Plano',
          student: { connect: { id: 'student-test' } },
          personal: { connect: { id: 'another-tenant' } },
          exercises: {
            create: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
          },
        },
      }),
    ).rejects.toThrow(/personal do tenant autenticado/);
  });
});
