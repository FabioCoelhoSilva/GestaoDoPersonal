import { apiRequest } from '@/lib/api/client';
import type { StudentRecord } from '@/lib/api/student-workout.service';

export type PaymentRecord = {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'OVERDUE' | 'CANCELLED' | 'FAILED';
  dueDate: string;
  amount: string | number;
  confirmedAt: string | null;
  contract: {
    id: string;
    status: string;
    cycle: 'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12';
    startDate: string;
    endDate: string;
    monthlyAmount: string | number;
    student: Pick<StudentRecord, 'id' | 'name' | 'email' | 'active'>;
  };
};

export type MonthlyContractInput = {
  studentId: string;
  cycle: 'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12';
  monthlyAmount: number;
  startDate: string;
};

export type AppointmentRecord = {
  id: string;
  workoutId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  student: Pick<StudentRecord, 'id' | 'name' | 'email' | 'active'>;
  workout: { id: string; title: string } | null;
};

export type AppointmentInput = {
  studentId: string;
  workoutId?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
};

export const financialService = {
  listPayments: (status?: 'PENDING' | 'CONFIRMED' | 'OVERDUE') =>
    apiRequest<PaymentRecord[]>(`payments${status ? `?status=${status}` : ''}`),
  createContract: (input: MonthlyContractInput) =>
    apiRequest('payments/contracts', { method: 'POST', body: input }),
  confirmPayment: (paymentId: string) =>
    apiRequest<PaymentRecord>(`payments/${encodeURIComponent(paymentId)}/confirm`, { method: 'PATCH' }),
  listAppointments: (from: Date, to: Date) => {
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    return apiRequest<AppointmentRecord[]>(`appointments?${query.toString()}`);
  },
  createAppointment: (input: AppointmentInput) =>
    apiRequest<AppointmentRecord>('appointments', { method: 'POST', body: input }),
  updateAppointmentStatus: (appointmentId: string, status: 'COMPLETED' | 'CANCELLED') =>
    apiRequest<AppointmentRecord>(`appointments/${encodeURIComponent(appointmentId)}/status`, {
      method: 'PATCH',
      body: { status },
    }),
};
