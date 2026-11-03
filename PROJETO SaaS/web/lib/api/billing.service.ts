import { apiRequest } from '@/lib/api/client';

export type TrainerProfile = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingPlanOption = { id: string; name: string };

export type StripeInvoice = {
  id: string;
  number: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  currency: string;
  amountDue: number;
  amountPaid: number;
  createdAt: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type TrainerSubscription = {
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    stripeCustomerLinked: boolean;
  } | null;
  plan: {
    name: string;
    maxStudents: number | null;
    maxWorkouts: number | null;
  } | null;
  accessAllowed: boolean;
};

export const billingService = {
  getProfile: () => apiRequest<TrainerProfile>('profile/me'),
  updateProfile: (name: string) =>
    apiRequest<TrainerProfile>('profile/me', { method: 'PATCH', body: { name } }),
  getSubscription: () => apiRequest<TrainerSubscription>('billing/me'),
  listPlans: () => apiRequest<BillingPlanOption[]>('billing/plans'),
  listInvoices: () => apiRequest<StripeInvoice[]>('billing/invoices'),
  createCheckout: (planId: string) =>
    apiRequest<{ url: string }>('billing/checkout', { method: 'POST', body: { planId } }),
  openBillingPortal: () => apiRequest<{ url: string }>('billing/portal', { method: 'POST' }),
};
