import { WorkoutExecutionStatus } from '@prisma/client';
import { scopedPrisma } from '../db/scoped-prisma';

export type WorkoutSetInput = {
  workoutExerciseId: string;
  setNumber: number;
  repsCompleted: number;
  loadKg: number | null;
};

export type CreateWorkoutExecutionInput = {
  studentId: string;
  workoutId: string;
  completed: boolean;
  sets: WorkoutSetInput[];
};

export class WorkoutExecutionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkoutExecutionValidationError';
  }
}

export class WorkoutExecutionNotFoundError extends Error {
  constructor() {
    super('Treino ou aluno não encontrado neste tenant');
    this.name = 'WorkoutExecutionNotFoundError';
  }
}

function requireIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 64) {
    throw new WorkoutExecutionValidationError(`${field} inválido`);
  }
  return value.trim();
}

function validateInput(input: CreateWorkoutExecutionInput) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkoutExecutionValidationError('Dados da execução inválidos');
  }

  const allowedFields = new Set(['studentId', 'workoutId', 'completed', 'sets']);
  const unknownFields = Object.keys(input).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new WorkoutExecutionValidationError(`Campos não permitidos: ${unknownFields.join(', ')}`);
  }
  if (typeof input.completed !== 'boolean') {
    throw new WorkoutExecutionValidationError('completed deve ser boolean');
  }
  if (!Array.isArray(input.sets) || input.sets.length === 0 || input.sets.length > 500) {
    throw new WorkoutExecutionValidationError('A execução deve conter entre 1 e 500 séries');
  }

  const seenSets = new Set<string>();
  const sets = input.sets.map((set, index) => {
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      throw new WorkoutExecutionValidationError(`sets[${index}] inválido`);
    }
    const setFields = new Set(['workoutExerciseId', 'setNumber', 'repsCompleted', 'loadKg']);
    const extraFields = Object.keys(set).filter((field) => !setFields.has(field));
    if (extraFields.length > 0) {
      throw new WorkoutExecutionValidationError(
        `Campos não permitidos em sets[${index}]: ${extraFields.join(', ')}`,
      );
    }

    const workoutExerciseId = requireIdentifier(set.workoutExerciseId, `sets[${index}].workoutExerciseId`);
    if (!Number.isInteger(set.setNumber) || set.setNumber < 1 || set.setNumber > 100) {
      throw new WorkoutExecutionValidationError(`sets[${index}].setNumber deve ser inteiro entre 1 e 100`);
    }
    if (!Number.isInteger(set.repsCompleted) || set.repsCompleted < 0 || set.repsCompleted > 1000) {
      throw new WorkoutExecutionValidationError(`sets[${index}].repsCompleted deve ser inteiro entre 0 e 1000`);
    }
    if (
      set.loadKg !== null &&
      (typeof set.loadKg !== 'number' ||
        !Number.isFinite(set.loadKg) ||
        set.loadKg < 0 ||
        set.loadKg > 1000 ||
        Math.round(set.loadKg * 100) !== set.loadKg * 100)
    ) {
      throw new WorkoutExecutionValidationError(`sets[${index}].loadKg deve estar entre 0 e 1000 kg, com até 2 casas decimais`);
    }

    const uniqueKey = `${workoutExerciseId}:${set.setNumber}`;
    if (seenSets.has(uniqueKey)) {
      throw new WorkoutExecutionValidationError('setNumber não pode repetir para o mesmo exercício');
    }
    seenSets.add(uniqueKey);
    return { workoutExerciseId, setNumber: set.setNumber, repsCompleted: set.repsCompleted, loadKg: set.loadKg };
  });

  return {
    studentId: requireIdentifier(input.studentId, 'studentId'),
    workoutId: requireIdentifier(input.workoutId, 'workoutId'),
    completed: input.completed,
    sets,
  };
}

export async function createWorkoutExecution(
  tenantId: string,
  input: CreateWorkoutExecutionInput,
) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new WorkoutExecutionValidationError('tenantId é obrigatório');
  }
  const data = validateInput(input);
  const db = scopedPrisma(tenantId);

  const workout = await db.workout.findFirst({
    where: { id: data.workoutId, studentId: data.studentId },
    select: { id: true, exercises: { select: { id: true } } },
  });
  if (!workout) throw new WorkoutExecutionNotFoundError();

  const exerciseIds = new Set(workout.exercises.map(({ id }) => id));
  if (data.sets.some(({ workoutExerciseId }) => !exerciseIds.has(workoutExerciseId))) {
    throw new WorkoutExecutionValidationError('Todas as séries devem referenciar exercícios deste treino');
  }

  return db.workoutExecution.create({
    data: {
      personal: { connect: { id: tenantId } },
      student: {
        connect: {
          id_personalId: { id: data.studentId, personalId: tenantId },
        },
      },
      workout: {
        connect: {
          id_personalId: { id: workout.id, personalId: tenantId },
        },
      },
      status: data.completed ? WorkoutExecutionStatus.COMPLETED : WorkoutExecutionStatus.IN_PROGRESS,
      ...(data.completed ? { completedAt: new Date() } : {}),
      setLogs: {
        create: data.sets.map((set) => ({
          setNumber: set.setNumber,
          repsCompleted: set.repsCompleted,
          loadKg: set.loadKg,
          personal: { connect: { id: tenantId } },
          workout: {
            connect: {
              id_personalId: { id: workout.id, personalId: tenantId },
            },
          },
          workoutExercise: { connect: { id: set.workoutExerciseId } },
        })),
      },
    },
    include: { setLogs: { orderBy: [{ workoutExerciseId: 'asc' }, { setNumber: 'asc' }] } },
  });
}

export async function listWorkoutExecutions(
  tenantId: string,
  studentId?: string,
) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new WorkoutExecutionValidationError('tenantId é obrigatório');
  }
  if (studentId !== undefined) requireIdentifier(studentId, 'studentId');

  return scopedPrisma(tenantId).workoutExecution.findMany({
    where: studentId ? { studentId } : {},
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    include: {
      setLogs: { orderBy: [{ workoutExerciseId: 'asc' }, { setNumber: 'asc' }] },
      workout: { select: { title: true } },
    },
  });
}

export async function completeWorkoutExecution(
  tenantId: string,
  executionId: string,
  studentId?: string,
) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new WorkoutExecutionValidationError('tenantId é obrigatório');
  }
  const id = requireIdentifier(executionId, 'executionId');
  if (studentId !== undefined) requireIdentifier(studentId, 'studentId');
  const db = scopedPrisma(tenantId);
  const where = {
    id,
    status: WorkoutExecutionStatus.IN_PROGRESS,
    ...(studentId ? { studentId } : {}),
  };
  const updated = await db.workoutExecution.updateMany({
    where,
    data: {
      status: WorkoutExecutionStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    const existing = await db.workoutExecution.findFirst({
      where: { id, ...(studentId ? { studentId } : {}) },
      include: { setLogs: { orderBy: [{ workoutExerciseId: 'asc' }, { setNumber: 'asc' }] } },
    });
    if (!existing) throw new WorkoutExecutionNotFoundError();
    if (existing.status === WorkoutExecutionStatus.COMPLETED) return existing;
    throw new Error('Execução alterada em simultâneo; tente novamente');
  }

  const execution = await db.workoutExecution.findFirst({
    where: { id, ...(studentId ? { studentId } : {}) },
    include: { setLogs: { orderBy: [{ workoutExerciseId: 'asc' }, { setNumber: 'asc' }] } },
  });
  if (!execution) throw new WorkoutExecutionNotFoundError();
  return execution;
}
