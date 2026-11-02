import { scopedPrisma } from '../db/scoped-prisma';
import { assertPlanCapacity } from '../billing/subscription.service';

export type CreateStudentData = {
  name: string;
  email: string;
  cpfEncrypted?: string | null;
  cpfHash?: string | null;
};

export type WorkoutExerciseInput = {
  name: string;
  gifUrl?: string | null;
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

export type UpdateStudentData = Partial<Pick<CreateStudentData, 'name' | 'email'>>;

export type UpdateWorkoutPlanData = {
  title?: string;
  description?: string | null;
  active?: boolean;
};

export type UpdateWorkoutExerciseData = Partial<WorkoutExerciseInput>;

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

export class TenantStudentRecordNotFoundError extends Error {
  constructor() {
    super('O aluno não existe ou não pertence ao tenant autenticado');
    this.name = 'TenantStudentRecordNotFoundError';
  }
}

export class TenantWorkoutNotFoundError extends Error {
  constructor() {
    super('O treino não existe ou não pertence ao tenant autenticado');
    this.name = 'TenantWorkoutNotFoundError';
  }
}

export class TenantWorkoutExerciseNotFoundError extends Error {
  constructor() {
    super('O exercício não existe ou não pertence ao tenant autenticado');
    this.name = 'TenantWorkoutExerciseNotFoundError';
  }
}

export class WorkoutHistoryConflictError extends Error {
  constructor() {
    super('O exercício possui séries registadas e não pode ser alterado ou removido');
    this.name = 'WorkoutHistoryConflictError';
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

function optionalGifUrl(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 2048) {
    throw new StudentWorkoutValidationError(`${field} deve ser uma URL HTTPS válida`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StudentWorkoutValidationError(`${field} deve ser uma URL HTTPS válida`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new StudentWorkoutValidationError(`${field} deve ser uma URL HTTPS válida`);
  }
  return url.toString();
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

function validateStudentUpdateData(data: UpdateStudentData) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StudentWorkoutValidationError('Dados do aluno inválidos');
  }
  const allowedFields = new Set(['name', 'email']);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new StudentWorkoutValidationError(`Campos não permitidos para aluno: ${unknownFields.join(', ')}`);
  }
  if (Object.keys(data).length === 0) {
    throw new StudentWorkoutValidationError('Informe pelo menos um campo para atualizar');
  }

  const update: UpdateStudentData = {};
  if (data.name !== undefined) update.name = requireText(data.name, 'name', 200);
  if (data.email !== undefined) {
    const email = requireText(data.email, 'email', 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new StudentWorkoutValidationError('email inválido');
    }
    update.email = email;
  }
  return update;
}

function validateWorkoutUpdateData(data: UpdateWorkoutPlanData) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StudentWorkoutValidationError('Dados do plano de treino inválidos');
  }
  const allowedFields = new Set(['title', 'description', 'active']);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new StudentWorkoutValidationError(`Campos não permitidos para plano: ${unknownFields.join(', ')}`);
  }
  if (Object.keys(data).length === 0) {
    throw new StudentWorkoutValidationError('Informe pelo menos um campo para atualizar');
  }

  const update: UpdateWorkoutPlanData = {};
  if (data.title !== undefined) update.title = requireText(data.title, 'title', 200);
  if (data.description !== undefined) update.description = optionalText(data.description, 'description', 5000);
  if (data.active !== undefined) {
    if (typeof data.active !== 'boolean') {
      throw new StudentWorkoutValidationError('active deve ser boolean');
    }
    update.active = data.active;
  }
  return update;
}

function validateExerciseUpdateData(data: UpdateWorkoutExerciseData) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StudentWorkoutValidationError('Dados do exercício inválidos');
  }
  const allowedFields = new Set([
    'name', 'gifUrl', 'sets', 'reps', 'restSeconds', 'order', 'notes',
  ]);
  const unknownFields = Object.keys(data).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new StudentWorkoutValidationError(`Campos não permitidos para exercício: ${unknownFields.join(', ')}`);
  }
  if (Object.keys(data).length === 0) {
    throw new StudentWorkoutValidationError('Informe pelo menos um campo para atualizar');
  }

  const update: UpdateWorkoutExerciseData = {};
  if (data.name !== undefined) update.name = requireText(data.name, 'name', 200);
  if (data.gifUrl !== undefined) update.gifUrl = optionalGifUrl(data.gifUrl, 'gifUrl');
  if (data.sets !== undefined) {
    if (!Number.isInteger(data.sets) || data.sets < 1 || data.sets > 100) {
      throw new StudentWorkoutValidationError('sets deve ser um inteiro entre 1 e 100');
    }
    update.sets = data.sets;
  }
  if (data.reps !== undefined) update.reps = requireText(data.reps, 'reps', 32);
  if (data.restSeconds !== undefined) {
    if (
      data.restSeconds !== null &&
      (!Number.isInteger(data.restSeconds) || data.restSeconds < 0 || data.restSeconds > 7200)
    ) {
      throw new StudentWorkoutValidationError('restSeconds deve ser um inteiro entre 0 e 7200');
    }
    update.restSeconds = data.restSeconds;
  }
  if (data.order !== undefined) {
    if (!Number.isInteger(data.order) || data.order < 0) {
      throw new StudentWorkoutValidationError('order deve ser um inteiro não negativo');
    }
    update.order = data.order;
  }
  if (data.notes !== undefined) update.notes = optionalText(data.notes, 'notes', 2000);
  return update;
}

function validateWorkoutExerciseInput(
  exercise: WorkoutExerciseInput,
  index?: number,
) {
  const field = index === undefined ? 'exercício' : `exercises[${index}]`;
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
    throw new StudentWorkoutValidationError(`${field} inválido`);
  }
  const exerciseFields = new Set(['name', 'gifUrl', 'sets', 'reps', 'restSeconds', 'order', 'notes']);
  const extraFields = Object.keys(exercise).filter((key) => !exerciseFields.has(key));
  if (extraFields.length > 0) {
    throw new StudentWorkoutValidationError(
      `Campos não permitidos em ${field}: ${extraFields.join(', ')}`,
    );
  }

  const name = requireText(exercise.name, `${field}.name`, 200);
  const gifUrl = optionalGifUrl(exercise.gifUrl, `${field}.gifUrl`);
  if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 100) {
    throw new StudentWorkoutValidationError(`${field}.sets deve ser um inteiro entre 1 e 100`);
  }
  const reps = requireText(exercise.reps, `${field}.reps`, 32);
  if (!Number.isInteger(exercise.order) || exercise.order < 0) {
    throw new StudentWorkoutValidationError(`${field}.order deve ser um inteiro não negativo`);
  }
  if (
    exercise.restSeconds !== undefined &&
    exercise.restSeconds !== null &&
    (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 7200)
  ) {
    throw new StudentWorkoutValidationError(
      `${field}.restSeconds deve ser um inteiro entre 0 e 7200`,
    );
  }

  const notes = optionalText(exercise.notes, `${field}.notes`, 2000);
  return {
    name,
    ...(gifUrl !== undefined ? { gifUrl } : {}),
    sets: exercise.sets,
    reps,
    order: exercise.order,
    ...(exercise.restSeconds !== undefined ? { restSeconds: exercise.restSeconds } : {}),
    ...(notes !== undefined ? { notes } : {}),
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

  const exercises = data.exercises.map(validateWorkoutExerciseInput);
  const orders = new Set<number>();
  for (const exercise of exercises) {
    if (orders.has(exercise.order)) {
      throw new StudentWorkoutValidationError('Cada exercício deve ter uma posição order única');
    }
    orders.add(exercise.order);
  }

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
  await assertPlanCapacity(tenant, 'students');
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

export async function getStudent(tenantId: string, studentId: string) {
  const tenant = requireTenantId(tenantId);
  return scopedPrisma(tenant).student.findFirst({
    where: { id: requireText(studentId, 'studentId', 64) },
  });
}

export async function updateStudent(
  tenantId: string,
  studentId: string,
  data: UpdateStudentData,
) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(studentId, 'studentId', 64);
  const update = validateStudentUpdateData(data);
  const db = scopedPrisma(tenant);
  const existing = await db.student.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new TenantStudentRecordNotFoundError();
  return db.student.update({ where: { id }, data: update });
}

export async function deactivateStudent(tenantId: string, studentId: string) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(studentId, 'studentId', 64);
  const db = scopedPrisma(tenant);
  const existing = await db.student.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new TenantStudentRecordNotFoundError();
  return db.student.update({ where: { id }, data: { active: false } });
}

export async function listWorkoutPlans(tenantId: string) {
  const tenant = requireTenantId(tenantId);
  return scopedPrisma(tenant).workout.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
}

export async function getWorkoutPlan(tenantId: string, workoutId: string) {
  const tenant = requireTenantId(tenantId);
  return scopedPrisma(tenant).workout.findFirst({
    where: { id: requireText(workoutId, 'workoutId', 64) },
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
}

export async function updateWorkoutPlan(
  tenantId: string,
  workoutId: string,
  data: UpdateWorkoutPlanData,
) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(workoutId, 'workoutId', 64);
  const update = validateWorkoutUpdateData(data);
  const db = scopedPrisma(tenant);
  const existing = await db.workout.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new TenantWorkoutNotFoundError();
  return db.workout.update({
    where: { id },
    data: update,
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
}

export async function archiveWorkoutPlan(tenantId: string, workoutId: string) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(workoutId, 'workoutId', 64);
  const db = scopedPrisma(tenant);
  const existing = await db.workout.findFirst({ where: { id }, select: { id: true } });
  if (!existing) throw new TenantWorkoutNotFoundError();
  return db.workout.update({
    where: { id },
    data: { active: false },
    include: { exercises: { orderBy: { order: 'asc' } } },
  });
}

export async function listWorkoutExercises(tenantId: string, workoutId: string) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(workoutId, 'workoutId', 64);
  const db = scopedPrisma(tenant);
  const workout = await db.workout.findFirst({ where: { id }, select: { id: true } });
  if (!workout) throw new TenantWorkoutNotFoundError();
  return db.workoutExercise.findMany({
    where: { workoutId: id },
    orderBy: { order: 'asc' },
  });
}

export async function createWorkoutExercise(
  tenantId: string,
  workoutId: string,
  input: WorkoutExerciseInput,
) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(workoutId, 'workoutId', 64);
  const validated = validateWorkoutExerciseInput(input);
  const db = scopedPrisma(tenant);
  const workout = await db.workout.findFirst({ where: { id }, select: { id: true } });
  if (!workout) throw new TenantWorkoutNotFoundError();
  return db.workoutExercise.create({
    data: {
      ...validated,
      workout: { connect: { id_personalId: { id, personalId: tenant } } },
    },
  });
}

async function findEditableWorkoutExercise(tenantId: string, exerciseId: string) {
  const tenant = requireTenantId(tenantId);
  const id = requireText(exerciseId, 'exerciseId', 64);
  const db = scopedPrisma(tenant);
  const exercise = await db.workoutExercise.findFirst({
    where: { id },
    select: { id: true, setLogs: { select: { id: true }, take: 1 } },
  });
  if (!exercise) throw new TenantWorkoutExerciseNotFoundError();
  if (exercise.setLogs.length > 0) throw new WorkoutHistoryConflictError();
  return { db, id };
}

export async function updateWorkoutExercise(
  tenantId: string,
  exerciseId: string,
  data: UpdateWorkoutExerciseData,
) {
  const update = validateExerciseUpdateData(data);
  const { db, id } = await findEditableWorkoutExercise(tenantId, exerciseId);
  return db.workoutExercise.update({ where: { id }, data: update });
}

export async function deleteWorkoutExercise(tenantId: string, exerciseId: string) {
  const { db, id } = await findEditableWorkoutExercise(tenantId, exerciseId);
  return db.workoutExercise.delete({ where: { id } });
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
  await assertPlanCapacity(tenant, 'workouts');

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
