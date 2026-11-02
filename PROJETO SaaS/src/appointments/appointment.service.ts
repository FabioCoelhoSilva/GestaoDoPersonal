import {
  AppointmentTimeConflictError,
  createTenantAppointment,
  scopedPrisma,
  TenantStudentUnavailableError,
} from '../db/scoped-prisma';

export class AppointmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentValidationError';
  }
}

export class AppointmentRecordNotFoundError extends Error {
  constructor() {
    super('Aula não encontrada');
    this.name = 'AppointmentRecordNotFoundError';
  }
}

export class AppointmentStateConflictError extends Error {
  constructor() {
    super('A aula só pode ser alterada enquanto estiver agendada');
    this.name = 'AppointmentStateConflictError';
  }
}

export type CreateAppointmentInput = {
  studentId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
};

function requireTenantId(tenantId: string) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new AppointmentValidationError('tenantId é obrigatório');
  }
  return tenantId;
}

function validDate(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppointmentValidationError(`${field} inválida`);
  return date;
}

export async function listAppointments(tenantId: string, from: string, to: string) {
  const tenant = requireTenantId(tenantId);
  const startsAt = validDate(from, 'from');
  const endsAt = validDate(to, 'to');
  if (startsAt >= endsAt) throw new AppointmentValidationError('from deve ser anterior a to');
  return scopedPrisma(tenant).appointment.findMany({
    where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    include: { student: { select: { id: true, name: true, email: true, active: true } } },
  });
}

export async function createAppointment(tenantId: string, input: CreateAppointmentInput) {
  const tenant = requireTenantId(tenantId);
  if (!input || typeof input !== 'object') throw new AppointmentValidationError('Dados da aula inválidos');
  if (typeof input.studentId !== 'string' || input.studentId.trim().length === 0) {
    throw new AppointmentValidationError('studentId é obrigatório');
  }
  if (typeof input.title !== 'string' || input.title.trim().length < 2 || input.title.trim().length > 160) {
    throw new AppointmentValidationError('title deve ter entre 2 e 160 caracteres');
  }
  const startsAt = validDate(input.startsAt, 'startsAt');
  const endsAt = validDate(input.endsAt, 'endsAt');
  const durationMs = endsAt.getTime() - startsAt.getTime();
  if (durationMs < 60_000 || durationMs > 8 * 60 * 60 * 1000) {
    throw new AppointmentValidationError('A aula deve durar entre 1 minuto e 8 horas');
  }
  if (input.notes !== undefined && input.notes !== null && typeof input.notes !== 'string') {
    throw new AppointmentValidationError('notes inválidas');
  }
  if (typeof input.notes === 'string' && input.notes.length > 2000) {
    throw new AppointmentValidationError('notes deve ter no máximo 2.000 caracteres');
  }

  return createTenantAppointment({
    personalId: tenant,
    studentId: input.studentId.trim(),
    title: input.title.trim(),
    startsAt,
    endsAt,
    notes: input.notes?.trim() || null,
  });
}

export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: 'COMPLETED' | 'CANCELLED',
) {
  const tenant = requireTenantId(tenantId);
  if (!appointmentId?.trim()) throw new AppointmentValidationError('appointmentId é obrigatório');
  const db = scopedPrisma(tenant);
  const appointment = await db.appointment.findFirst({ where: { id: appointmentId.trim() } });
  if (!appointment) throw new AppointmentRecordNotFoundError();
  if (appointment.status !== 'SCHEDULED') throw new AppointmentStateConflictError();
  return db.appointment.update({
    where: { id: appointment.id },
    data: { status },
    include: { student: { select: { id: true, name: true, email: true, active: true } } },
  });
}

export { AppointmentTimeConflictError, TenantStudentUnavailableError };
