import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  scopedPrisma,
  workoutFindFirst,
  executionCreate,
  executionFindMany,
  executionUpdateMany,
  executionFindFirst,
} = vi.hoisted(() => ({
  scopedPrisma: vi.fn(),
  workoutFindFirst: vi.fn(),
  executionCreate: vi.fn(),
  executionFindMany: vi.fn(),
  executionUpdateMany: vi.fn(),
  executionFindFirst: vi.fn(),
}));

vi.mock('../src/db/scoped-prisma', () => ({ scopedPrisma }));

import {
  createWorkoutExecution,
  completeWorkoutExecution,
  listWorkoutExecutions,
  WorkoutExecutionNotFoundError,
  WorkoutExecutionValidationError,
} from '../src/students/workout-execution.service';

const validInput = {
  studentId: 'student-1',
  workoutId: 'workout-1',
  completed: true,
  sets: [{
    workoutExerciseId: 'exercise-1',
    setNumber: 1,
    repsCompleted: 10,
    loadKg: 42.5,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  scopedPrisma.mockReturnValue({
    workout: { findFirst: workoutFindFirst },
    workoutExecution: {
      create: executionCreate,
      findMany: executionFindMany,
      updateMany: executionUpdateMany,
      findFirst: executionFindFirst,
    },
  });
  workoutFindFirst.mockResolvedValue({
    id: 'workout-1',
    exercises: [{ id: 'exercise-1' }],
  });
});

describe('workout execution service', () => {
  it('validates tenant ownership and creates completion and set logs in one nested write', async () => {
    executionCreate.mockResolvedValue({ id: 'execution-1' });

    await expect(createWorkoutExecution('tenant-1', validInput))
      .resolves.toEqual({ id: 'execution-1' });
    expect(scopedPrisma).toHaveBeenCalledWith('tenant-1');
    expect(workoutFindFirst).toHaveBeenCalledWith({
      where: { id: 'workout-1', studentId: 'student-1' },
      select: { id: true, exercises: { select: { id: true } } },
    });
    expect(executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        personal: { connect: { id: 'tenant-1' } },
        student: {
          connect: {
            id_personalId: { id: 'student-1', personalId: 'tenant-1' },
          },
        },
        workout: {
          connect: {
            id_personalId: { id: 'workout-1', personalId: 'tenant-1' },
          },
        },
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        setLogs: {
          create: [{
            setNumber: 1,
            repsCompleted: 10,
            loadKg: 42.5,
            personal: { connect: { id: 'tenant-1' } },
            workout: {
              connect: {
                id_personalId: { id: 'workout-1', personalId: 'tenant-1' },
              },
            },
            workoutExercise: { connect: { id: 'exercise-1' } },
          }],
        },
      }),
    }));
  });

  it('rejects workouts not owned by the tenant and exercises from another workout', async () => {
    workoutFindFirst.mockResolvedValueOnce(null);
    await expect(createWorkoutExecution('tenant-1', validInput))
      .rejects.toBeInstanceOf(WorkoutExecutionNotFoundError);

    workoutFindFirst.mockResolvedValueOnce({ id: 'workout-1', exercises: [] });
    await expect(createWorkoutExecution('tenant-1', validInput))
      .rejects.toBeInstanceOf(WorkoutExecutionValidationError);
    expect(executionCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate set numbers and invalid load values before database access', async () => {
    await expect(createWorkoutExecution('tenant-1', {
      ...validInput,
      sets: [validInput.sets[0], validInput.sets[0]],
    })).rejects.toThrow(/não pode repetir/);
    await expect(createWorkoutExecution('tenant-1', {
      ...validInput,
      sets: [{ ...validInput.sets[0], loadKg: 1001 }],
    })).rejects.toThrow(/loadKg/);
    expect(scopedPrisma).not.toHaveBeenCalled();
  });

  it('lists history through the tenant-scoped client in descending time order', async () => {
    executionFindMany.mockResolvedValue([]);

    await expect(listWorkoutExecutions('tenant-1', 'student-1')).resolves.toEqual([]);
    expect(executionFindMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      include: {
        setLogs: { orderBy: [{ workoutExerciseId: 'asc' }, { setNumber: 'asc' }] },
        workout: { select: { title: true } },
      },
    });
  });

  it('completes only an in-progress execution in the authenticated tenant and student scope', async () => {
    executionUpdateMany.mockResolvedValue({ count: 1 });
    executionFindFirst.mockResolvedValue({ id: 'execution-1', status: 'COMPLETED' });

    await expect(completeWorkoutExecution('tenant-1', 'execution-1', 'student-1'))
      .resolves.toMatchObject({ status: 'COMPLETED' });
    expect(executionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'execution-1',
        status: 'IN_PROGRESS',
        studentId: 'student-1',
      },
      data: {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      },
    });
  });
});
