import { scopedPrisma } from '../db/scoped-prisma';

export type CreateStudentData = {
  name: string;
  email: string;
  cpfEncrypted?: string | null;
  cpfHash?: string | null;
};

export type WorkoutExerciseInput = {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number | null;
  order: number;
  notes?: string | null;
};

export type CreateWorkoutPlanData = {
  studentId: string;
  title: string;
  description?: string | null;
  active?: boolean;
  exercises: WorkoutExerciseInput[];
};

export class StudentWorkoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudentWorkoutValidationError';
  }
}

export class TenantStudentNotFoundError extends Error {
  constructor() {
    super('O aluno não existe ou não pertence ao tenant autenticado');
    this.name = 'TenantStudentNotFoundError';
  }
}

function requireTenantId(tenantId: string) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new StudentWorkoutValidationError('tenantId é obrigatório');
  }
  return tenantId;
}

function requireText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new StudentWorkoutValidationError(`${field} é obrigatório`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new StudentWorkoutValidationError(`${field} deve ter no máximo ${maxLength} caracteres`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new StudentWorkoutValidationError(`${field} deve ser texto`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new StudentWorkoutValidationError(`${field} deve ter no máximo ${maxLength} caracteres`);
  }
  return normalized;
}

function optionalProtectedValue(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new StudentWorkoutValidationError(`${field} deve ser texto válido com até ${maxLength} caracteres`);
  }
  return value;
}

function validateStudentData(data: CreateStudentData) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StudentWorkoutValidationError('Dados do aluno inválidos');
  }
  const allowedFields = new Set(['name', 'email', 'cpfEncrypted', 'cpfHash']);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new StudentWorkoutValidationError(`Campos não permitidos para aluno: ${unknownFields.join(', ')}`);
  }

  const name = requireText(data.name, 'name', 200);
  const email = requireText(data.email, 'email', 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new StudentWorkoutValidationError('email inválido');
  }
  const cpfEncrypted = optionalProtectedValue(data.cpfEncrypted, 'cpfEncrypted', 4096);
  const cpfHash = optionalProtectedValue(data.cpfHash, 'cpfHash', 256);

  return {
    name,
    email,
    ...(cpfEncrypted !== undefined ? { cpfEncrypted } : {}),
    ...(cpfHash !== undefined ? { cpfHash } : {}),
  };
}

function validateWorkoutPlanData(data: CreateWorkoutPlanData) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StudentWorkoutValidationError('Dados do plano de treino inválidos');
  }
  const allowedFields = new Set(['studentId', 'title', 'description', 'active', 'exercises']);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new StudentWorkoutValidationError(`Campos não permitidos para plano: ${unknownFields.join(', ')}`);
  }

  const studentId = requireText(data.studentId, 'studentId', 64);
  const title = requireText(data.title, 'title', 200);
  const description = optionalText(data.description, 'description', 5000);
  if (data.active !== undefined && typeof data.active !== 'boolean') {
    throw new StudentWorkoutValidationError('active deve ser boolean');
  }
  if (!Array.isArray(data.exercises) || data.exercises.length === 0) {
    throw new StudentWorkoutValidationError('O plano deve conter pelo menos um exercício');
  }

  const orders = new Set<number>();
  const exercises = data.exercises.map((exercise, index) => {
    if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
      throw new StudentWorkoutValidationError(`exercises[${index}] inválido`);
    }
    const exerciseFields = new Set(['name', 'sets', 'reps', 'restSeconds', 'order', 'notes']);
    const extraFields = Object.keys(exercise).filter((field) => !exerciseFields.has(field));
    if (extraFields.length > 0) {
      throw new StudentWorkoutValidationError(
        `Campos não permitidos em exercises[${index}]: ${extraFields.join(', ')}`,
      );
    }

    const name = requireText(exercise.name, `exercises[${index}].name`, 200);
    if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 100) {
      throw new StudentWorkoutValidationError(`exercises[${index}].sets deve ser um inteiro entre 1 e 100`);
    }
    const reps = requireText(exercise.reps, `exercises[${index}].reps`, 32);
    if (!Number.isInteger(exercise.order) || exercise.order < 0) {
      throw new StudentWorkoutValidationError(`exercises[${index}].order deve ser um inteiro não negativo`);
    }
    if (orders.has(exercise.order)) {
      throw new StudentWorkoutValidationError('Cada exercício deve ter uma posição order única');
    }
    orders.add(exercise.order);

    if (
      exercise.restSeconds !== undefined &&
      exercise.restSeconds !== null &&
      (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 7200)
    ) {
      throw new StudentWorkoutValidationError(
        `exercises[${index}].restSeconds deve ser um inteiro entre 0 e 7200`,
      );
    }

    const notes = optionalText(exercise.notes, `exercises[${index}].notes`, 2000);
    return {
      name,
      sets: exercise.sets,
      reps,
      order: exercise.order,
      ...(exercise.restSeconds !== undefined ? { restSeconds: exercise.restSeconds } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };
  });

  return {
    studentId,
    title,
    ...(description !== undefined ? { description } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    exercises,
  };
}

export async function createStudent(tenantId: string, data: CreateStudentData) {
  const tenant = requireTenantId(tenantId);
  const studentData = validateStudentData(data);
  return scopedPrisma(tenant).student.create({
    data: { ...studentData, personal: { connect: { id: tenant } } },
  });
}

export async function listStudents(tenantId: string) {
  const tenant = requireTenantId(tenantId);
  return scopedPrisma(tenant).student.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function createWorkoutPlan(tenantId: string, data: CreateWorkoutPlanData) {
  const tenant = requireTenantId(tenantId);
  const planData = validateWorkoutPlanData(data);
  const db = scopedPrisma(tenant);

  const student = await db.student.findFirst({
    where: { id: planData.studentId },
    select: { id: true },
  });
  if (!student) throw new TenantStudentNotFoundError();

  return db.workout.create({
    data: {
      title: planData.title,
      ...(planData.description !== undefined ? { description: planData.description } : {}),
      ...(planData.active !== undefined ? { active: planData.active } : {}),
      personal: { connect: { id: tenant } },
      student: { connect: { id: student.id } },
      exercises: { create: planData.exercises },
    },
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
}
