'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  billingService,
  type BillingPlanOption,
  type StripeInvoice,
  type TrainerProfile,
  type TrainerSubscription,
} from '@/lib/api/billing.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

function subscriptionStatus(status: string) {
  if (status === 'ACTIVE') return { label: 'Ativo', className: 'active' };
  if (status === 'CANCELED' || status === 'INCOMPLETE_EXPIRED') return { label: 'Cancelado', className: 'inactive' };
  return { label: 'Pendente', className: '' };
}

function invoiceStatus(status: StripeInvoice['status']) {
  if (status === 'paid') return { label: 'Pago', className: 'active' };
  if (status === 'void' || status === 'uncollectible') return { label: 'Cancelada', className: 'inactive' };
  return { label: 'Pendente', className: '' };
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value));
}

export default function ProfilePage() {
  const { session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [billing, setBilling] = useState<TrainerSubscription | null>(null);
  const [plans, setPlans] = useState<BillingPlanOption[]>([]);
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [profileResult, billingResult, plansResult, invoicesResult] = await Promise.allSettled([
      billingService.getProfile(),
      billingService.getSubscription(),
      billingService.listPlans(),
      billingService.listInvoices(),
    ]);

    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
      setName(profileResult.value.name);
    }
    if (billingResult.status === 'fulfilled') setBilling(billingResult.value);
    if (plansResult.status === 'fulfilled') setPlans(plansResult.value);
    if (invoicesResult.status === 'fulfilled') {
      setInvoices(invoicesResult.value);
      setInvoiceError(null);
    } else {
      setInvoices([]);
      setInvoiceError(
        invoicesResult.reason instanceof ApiError && invoicesResult.reason.code === 'STRIPE_CUSTOMER_NOT_LINKED'
          ? null
          : invoicesResult.reason instanceof Error
            ? invoicesResult.reason.message
            : 'Não foi possível carregar as faturas Stripe.',
      );
    }
    const primaryFailure = [profileResult, billingResult, plansResult].find((result) => result.status === 'rejected');
    setError(primaryFailure?.status === 'rejected'
      ? primaryFailure.reason instanceof Error ? primaryFailure.reason.message : 'Não foi possível carregar o perfil.'
      : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && session) void loadData();
  }, [authLoading, loadData, session]);

  useEffect(() => {
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (checkout === 'success') setNotice('Checkout concluído. A subscrição será atualizada quando o Stripe confirmar o webhook.');
    if (checkout === 'cancelled') setNotice('Checkout cancelado; nenhuma subscrição foi criada.');
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await billingService.updateProfile(name);
      setProfile(updated);
      setName(updated.name);
      setSuccess('Perfil atualizado.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function checkout(planId: string) {
    setWorking(true);
    setError(null);
    try {
      const result = await billingService.createCheckout(planId);
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o checkout Stripe.');
      setWorking(false);
    }
  }

  async function openPortal() {
    setWorking(true);
    setError(null);
    try {
      const result = await billingService.openBillingPortal();
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o portal de faturação.');
      setWorking(false);
    }
  }

  const currentStatus = billing?.subscription ? subscriptionStatus(billing.subscription.status) : null;
  const canCheckout = !billing?.subscription ||
    ['CANCELED', 'INCOMPLETE_EXPIRED'].includes(billing.subscription.status) ||
    (billing.subscription.status === 'TRIALING' && !billing.subscription.stripeCustomerLinked);

  return (
    <WorkspaceShell title="Perfil e subscrição" eyebrow="Gira os seus dados, o plano Impetus e as faturas Stripe.">
      {error && <p className="inline-message error page-message" role="alert">{error}</p>}
      {success && <p className="inline-message success page-message" role="status">{success}</p>}
      {notice && <p className="inline-message success page-message" role="status">{notice}</p>}
      {loading ? <div className="list-empty"><span className="spinner" />A carregar perfil e faturação…</div> : (
        <div className="profile-billing-grid">
          <section className="form-panel">
            <div className="panel-heading"><span className="panel-kicker">DADOS DA CONTA</span><h2>Perfil do personal</h2><p>O email de autenticação também é usado na faturação Stripe.</p></div>
            <form className="workspace-form" onSubmit={saveProfile}>
              <label htmlFor="profile-name">Nome</label>
              <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required />
              <label htmlFor="profile-email">Email</label>
              <input id="profile-email" value={profile?.email ?? ''} readOnly />
              <button className="button button-primary" disabled={saving || name.trim() === profile?.name}>
                {saving ? 'A guardar…' : 'Guardar perfil'}
              </button>
            </form>
          </section>

          <section className="list-panel">
            <div className="panel-heading list-heading">
              <div><span className="panel-kicker">IMPETUS · STRIPE</span><h2>Subscrição</h2></div>
              {currentStatus && <span className={`status-pill ${currentStatus.className}`}>{currentStatus.label}</span>}
            </div>
            <div className="billing-profile-summary">
              <strong>{billing?.plan?.name ?? 'Sem plano associado'}</strong>
              <span>{billing?.subscription?.currentPeriodEnd
                ? `Período até ${formatDate(billing.subscription.currentPeriodEnd)}`
                : 'O estado é atualizado automaticamente pelo webhook Stripe.'}</span>
              {billing?.subscription?.cancelAtPeriodEnd && <span>A subscrição será cancelada no fim do período atual.</span>}
              {!billing?.subscription && <span>Escolha um plano ativo para iniciar uma subscrição segura no Stripe.</span>}
            </div>
            {billing?.subscription?.stripeCustomerLinked &&
              billing.subscription.status !== 'CANCELED' &&
              billing.subscription.status !== 'INCOMPLETE_EXPIRED' && (
              <button className="button button-quiet" onClick={() => void openPortal()} disabled={working}>
                {working ? 'A abrir Stripe…' : 'Gerir subscrição e método de pagamento'}
              </button>
            )}
            {canCheckout && plans.length > 0 && (
              <div className="billing-plan-options">
                <h3>{billing?.subscription ? 'Voltar a subscrever' : 'Planos disponíveis'}</h3>
                {plans.map((plan) => (
                  <div className="billing-plan-row" key={plan.id}>
                    <strong>{plan.name}</strong>
                    <button className="text-button accent" type="button" disabled={working} onClick={() => void checkout(plan.id)}>
                      {working ? 'A abrir…' : 'Subscrever'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="list-panel profile-invoices">
            <div className="panel-heading list-heading">
              <div><span className="panel-kicker">STRIPE</span><h2>Faturas</h2></div>
              <span className="count-badge">{invoices.length} recentes</span>
            </div>
            {invoiceError ? <p className="inline-message error" role="alert">{invoiceError}</p> :
              invoices.length === 0 ? (
                <div className="list-empty compact"><strong>Sem faturas Stripe</strong><p>As faturas aparecem aqui quando houver um cliente e cobrança associados.</p></div>
              ) : (
                <div className="payment-list">
                  {invoices.map((invoice) => {
                    const status = invoiceStatus(invoice.status);
                    return (
                      <article className="payment-row" key={invoice.id}>
                        <div className="payment-info">
                          <strong>{invoice.number ?? `Fatura ${invoice.id}`}</strong>
                          <span>{formatAmount(invoice.amountPaid || invoice.amountDue, invoice.currency)} · {formatDate(invoice.createdAt)}</span>
                        </div>
                        <div className="payment-actions">
                          <span className={`status-pill ${status.className}`}>{status.label}</span>
                          {invoice.hostedInvoiceUrl && <a className="text-button accent" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">Abrir ↗</a>}
                          {invoice.invoicePdf && <a className="text-button" href={invoice.invoicePdf} target="_blank" rel="noreferrer">PDF</a>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
