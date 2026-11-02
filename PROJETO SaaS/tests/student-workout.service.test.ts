import { beforeEach, describe, expect, it, vi } from 'vitest';

const { scopedPrisma, assertPlanCapacity, studentCreate, studentFindFirst, studentFindMany, workoutCreate } = vi.hoisted(() => ({
  scopedPrisma: vi.fn(),
  assertPlanCapacity: vi.fn(),
  studentCreate: vi.fn(),
  studentFindFirst: vi.fn(),
  studentFindMany: vi.fn(),
  workoutCreate: vi.fn(),
}));

vi.mock('../src/db/scoped-prisma', () => ({
  scopedPrisma,
}));
vi.mock('../src/billing/subscription.service', () => ({ assertPlanCapacity }));

import {
  createStudent,
  createWorkoutPlan,
  listStudents,
  StudentWorkoutValidationError,
  TenantStudentNotFoundError,
} from '../src/students/student-workout.service';

beforeEach(() => {
  vi.clearAllMocks();
  scopedPrisma.mockReturnValue({
    student: {
      create: studentCreate,
      findFirst: studentFindFirst,
      findMany: studentFindMany,
    },
    workout: { create: workoutCreate },
  });
});

describe('student-workout service', () => {
  it('creates a student using the tenant-scoped client and rejects tenant fields from input', async () => {
    const created = { id: 'student-1', personalId: 'tenant-1' };
    studentCreate.mockResolvedValue(created);

    await expect(
      createStudent('tenant-1', { name: ' Ana ', email: 'ANA@example.com' }),
    ).resolves.toEqual(created);
    expect(assertPlanCapacity).toHaveBeenCalledWith('tenant-1', 'students');
    expect(scopedPrisma).toHaveBeenCalledWith('tenant-1');
    expect(studentCreate).toHaveBeenCalledWith({
      data: {
        name: 'Ana',
        email: 'ana@example.com',
        personal: { connect: { id: 'tenant-1' } },
      },
    });

    await expect(
      createStudent('tenant-1', {
        name: 'Ana',
        email: 'ana@example.com',
        personalId: 'another-tenant',
      } as never),
    ).rejects.toThrow(/Campos não permitidos/);
  });

  it('lists only through the scoped client in ascending creation order', async () => {
    studentFindMany.mockResolvedValue([]);

    await expect(listStudents('tenant-1')).resolves.toEqual([]);
    expect(scopedPrisma).toHaveBeenCalledWith('tenant-1');
    expect(studentFindMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('rejects a workout plan when the student does not belong to the authenticated tenant', async () => {
    studentFindFirst.mockResolvedValue(null);

    await expect(
      createWorkoutPlan('tenant-1', {
        studentId: 'student-from-another-tenant',
        title: 'Plano A',
        exercises: [{ name: 'Agachamento', sets: 3, reps: '8-12', order: 0 }],
      }),
    ).rejects.toBeInstanceOf(TenantStudentNotFoundError);
    expect(studentFindFirst).toHaveBeenCalledWith({
      where: { id: 'student-from-another-tenant' },
      select: { id: true },
    });
    expect(workoutCreate).not.toHaveBeenCalled();
  });

  it('creates a plan and exercises together only after tenant-scoped student lookup succeeds', async () => {
    studentFindFirst.mockResolvedValue({ id: 'student-1' });
    const created = { id: 'workout-1', exercises: [{ name: 'Agachamento', order: 0 }] };
    workoutCreate.mockResolvedValue(created);

    await expect(
      createWorkoutPlan('tenant-1', {
        studentId: 'student-1',
        title: 'Plano A',
        exercises: [{
          name: ' Agachamento ',
          gifUrl: 'https://cdn.example.com/exercises/squat.gif',
          sets: 3,
          reps: '8-12',
          restSeconds: 90,
          order: 0,
          notes: 'Manter postura',
        }],
      }),
    ).resolves.toEqual(created);
    expect(assertPlanCapacity).toHaveBeenCalledWith('tenant-1', 'workouts');
    expect(workoutCreate).toHaveBeenCalledWith({
      data: {
        title: 'Plano A',
        personal: { connect: { id: 'tenant-1' } },
        student: { connect: { id: 'student-1' } },
        exercises: {
          create: [{
            name: 'Agachamento',
            gifUrl: 'https://cdn.example.com/exercises/squat.gif',
            sets: 3,
            reps: '8-12',
            order: 0,
            restSeconds: 90,
            notes: 'Manter postura',
          }],
        },
      },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
  });

  it('rejects malformed or empty workout exercise lists before database access', async () => {
    await expect(
      createWorkoutPlan('tenant-1', {
        studentId: 'student-1',
        title: 'Plano A',
        exercises: [],
      }),
    ).rejects.toBeInstanceOf(StudentWorkoutValidationError);
    expect(scopedPrisma).not.toHaveBeenCalled();
  });
});
