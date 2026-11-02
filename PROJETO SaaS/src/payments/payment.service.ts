import { ParcelStatus, Prisma } from '@prisma/client';
import {
  createMonthlyContractWithParcels,
  scopedPrisma,
} from '../db/scoped-prisma';

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export class PaymentRecordNotFoundError extends Error {
  constructor() {
    super('Pagamento não encontrado');
    this.name = 'PaymentRecordNotFoundError';
  }
}

export class PaymentStateConflictError extends Error {
  constructor() {
    super('Este pagamento não pode ser confirmado no estado atual');
    this.name = 'PaymentStateConflictError';
  }
}

export type CreateMonthlyContractInput = {
  studentId: string;
  cycle: 'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12';
  monthlyAmount: number;
  startDate: string;
};

function requireTenantId(tenantId: string) {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new PaymentValidationError('tenantId é obrigatório');
  }
  return tenantId;
}

function addMonthsClamped(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function cycleMonths(cycle: CreateMonthlyContractInput['cycle']) {
  if (cycle === 'MONTHS_3') return 3;
  if (cycle === 'MONTHS_6') return 6;
  return 12;
}

function normalizeMonthlyAmount(amount: number) {
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1_000_000) {
    throw new PaymentValidationError('monthlyAmount deve estar entre 0,01 e 1.000.000');
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 0.000001) {
    throw new PaymentValidationError('monthlyAmount deve ter no máximo duas casas decimais');
  }
  return { cents, decimal: new Prisma.Decimal(cents).dividedBy(100).toFixed(2) };
}

function validDate(value: string, field: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new PaymentValidationError(`${field} inválida`);
  return date;
}

export async function listPayments(tenantId: string, filter?: 'PENDING' | 'CONFIRMED' | 'OVERDUE') {
  const tenant = requireTenantId(tenantId);
  const now = new Date();
  const status: Prisma.EnumParcelStatusFilter = filter === 'OVERDUE'
    ? { equals: ParcelStatus.PENDING }
    : filter
      ? { equals: filter }
      : { in: [ParcelStatus.PENDING, ParcelStatus.CONFIRMED, ParcelStatus.FAILED] };

  const parcels = await scopedPrisma(tenant).paymentParcel.findMany({
    where: {
      status,
      ...(filter === 'OVERDUE' ? { dueDate: { lt: now } } : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    include: {
      contract: {
        select: {
          id: true,
          status: true,
          cycle: true,
          startDate: true,
          endDate: true,
          monthlyAmount: true,
          student: { select: { id: true, name: true, email: true, active: true } },
        },
      },
    },
  });

  return parcels.map((parcel) => ({
    ...parcel,
    paymentStatus:
      parcel.status === ParcelStatus.PENDING && parcel.dueDate < now
        ? 'OVERDUE'
        : parcel.status,
    contractStatus:
      parcel.contract.status === 'SIGNED' && parcel.contract.endDate >= now
        ? 'ACTIVE'
        : parcel.contract.status,
  }));
}

export async function createMonthlyContract(tenantId: string, input: CreateMonthlyContractInput) {
  const tenant = requireTenantId(tenantId);
  if (!input || !['MONTHS_3', 'MONTHS_6', 'MONTHS_12'].includes(input.cycle)) {
    throw new PaymentValidationError('cycle inválido');
  }
  if (typeof input.studentId !== 'string' || input.studentId.trim().length === 0) {
    throw new PaymentValidationError('studentId é obrigatório');
  }
  const { cents, decimal } = normalizeMonthlyAmount(input.monthlyAmount);
  const startDate = validDate(input.startDate, 'startDate');
  const months = cycleMonths(input.cycle);
  const endDate = addMonthsClamped(startDate, months);
  const totalAmount = new Prisma.Decimal(cents * months).dividedBy(100).toFixed(2);

  return createMonthlyContractWithParcels({
    personalId: tenant,
    studentId: input.studentId.trim(),
    cycle: input.cycle,
    monthlyAmount: decimal,
    totalAmount,
    startDate,
    endDate,
    parcels: Array.from({ length: months }, (_, index) => ({
      dueDate: addMonthsClamped(startDate, index),
      amount: decimal,
    })),
  });
}

export async function confirmPayment(tenantId: string, paymentId: string) {
  const tenant = requireTenantId(tenantId);
  if (typeof paymentId !== 'string' || paymentId.trim().length === 0) {
    throw new PaymentValidationError('paymentId é obrigatório');
  }
  const db = scopedPrisma(tenant);
  const payment = await db.paymentParcel.findFirst({ where: { id: paymentId.trim() } });
  if (!payment) throw new PaymentRecordNotFoundError();
  if (payment.status === ParcelStatus.CONFIRMED) return payment;
  if (payment.status !== ParcelStatus.PENDING && payment.status !== ParcelStatus.FAILED) {
    throw new PaymentStateConflictError();
  }
  return db.paymentParcel.update({
    where: { id: payment.id },
    data: { status: ParcelStatus.CONFIRMED, confirmedAt: new Date() },
  });
}
