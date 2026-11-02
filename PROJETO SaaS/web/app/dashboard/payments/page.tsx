'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { financialService, type PaymentRecord } from '@/lib/api/financial.service';
import { studentWorkoutService, type StudentRecord } from '@/lib/api/student-workout.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

function money(value: string | number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(Number(value));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value));
}

export default function PaymentsPage() {
  const { session, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [studentId, setStudentId] = useState('');
  const [cycle, setCycle] = useState<'MONTHS_3' | 'MONTHS_6' | 'MONTHS_12'>('MONTHS_3');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingPaymentId, setWorkingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [studentsResult, paymentsResult] = await Promise.allSettled([
      studentWorkoutService.listStudents(),
      financialService.listPayments(),
    ]);
    if (studentsResult.status === 'fulfilled') {
      const activeStudents = studentsResult.value.filter((student) => student.active);
      setStudents(activeStudents);
      setStudentId((current) => current || activeStudents[0]?.id || '');
    }
    if (paymentsResult.status === 'fulfilled') setPayments(paymentsResult.value);
    const failure = [studentsResult, paymentsResult].find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      setError(failure.reason instanceof Error ? failure.reason.message : 'Não foi possível carregar os pagamentos.');
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && session) void loadData();
  }, [authLoading, loadData, session]);

  const totals = useMemo(() => ({
    pending: payments.filter((payment) => payment.paymentStatus === 'PENDING').length,
    overdue: payments.filter((payment) => payment.paymentStatus === 'OVERDUE').length,
    received: payments.filter((payment) => payment.paymentStatus === 'CONFIRMED')
      .reduce((sum, payment) => sum + Number(payment.amount), 0),
  }), [payments]);

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await financialService.createContract({
        studentId,
        cycle,
        monthlyAmount: Number(monthlyAmount),
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
      });
      setSuccess('Contrato registado e mensalidades geradas. Os pagamentos podem ser confirmados manualmente.');
      setMonthlyAmount('');
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível registar o contrato.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmPayment(paymentId: string) {
    setWorkingPaymentId(paymentId);
    setError(null);
    setSuccess(null);
    try {
      await financialService.confirmPayment(paymentId);
      setSuccess('Pagamento confirmado.');
      await loadData();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível confirmar o pagamento.');
    } finally {
      setWorkingPaymentId(null);
    }
  }

  return (
    <WorkspaceShell title="Pagamentos" eyebrow="Acompanhe contratos, mensalidades e pagamentos dos seus alunos.">
      {error && <p className="inline-message error page-message" role="alert">{error}</p>}
      {success && <p className="inline-message success page-message" role="status">{success}</p>}
      <div className="financial-summary">
        <article className="metric-card"><p className="metric-label">Mensalidades pendentes</p><p className="metric-value">{totals.pending}</p><p className="metric-detail">Aguardam confirmação</p></article>
        <article className="metric-card"><p className="metric-label">Em atraso</p><p className="metric-value">{totals.overdue}</p><p className="metric-detail">Vencidas e por regularizar</p></article>
        <article className="metric-card"><p className="metric-label">Recebido</p><p className="metric-value">{money(totals.received)}</p><p className="metric-detail">Pagamentos confirmados</p></article>
      </div>
      <div className="workspace-content-grid financial-layout">
        <section className="form-panel">
          <div className="panel-heading"><span className="panel-kicker">NOVO CONTRATO</span><h2>Registar mensalidade</h2><p>Cria o contrato e as parcelas mensais. A cobrança é registada manualmente.</p></div>
          {students.length === 0 && !loading ? (
            <div className="list-empty compact"><span aria-hidden="true">♙</span><strong>Sem alunos ativos</strong><p>Adicione um aluno antes de criar um contrato.</p><a className="text-link" href="/dashboard/students">Ir para alunos ↗</a></div>
          ) : (
            <form className="workspace-form" onSubmit={createContract}>
              <label htmlFor="payment-student">Aluno</label>
              <select id="payment-student" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <label htmlFor="payment-cycle">Duração do contrato</label>
              <select id="payment-cycle" value={cycle} onChange={(event) => setCycle(event.target.value as typeof cycle)}>
                <option value="MONTHS_3">3 meses</option><option value="MONTHS_6">6 meses</option><option value="MONTHS_12">12 meses</option>
              </select>
              <label htmlFor="payment-amount">Valor mensal (€)</label>
              <input id="payment-amount" type="number" min="0.01" max="1000000" step="0.01" value={monthlyAmount} onChange={(event) => setMonthlyAmount(event.target.value)} required />
              <label htmlFor="payment-start">Início do contrato</label>
              <input id="payment-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              <button className="button button-primary" disabled={saving || !studentId}>{saving ? 'A registar…' : 'Criar contrato e parcelas'}</button>
            </form>
          )}
        </section>
        <section className="list-panel">
          <div className="panel-heading list-heading"><div><span className="panel-kicker">CONTROLO FINANCEIRO</span><h2>Mensalidades</h2></div><span className="count-badge">{payments.length} registos</span></div>
          {loading ? <div className="list-empty"><span aria-hidden="true">◷</span><strong>A carregar pagamentos…</strong></div> : payments.length === 0 ? (
            <div className="list-empty"><span aria-hidden="true">◇</span><strong>Ainda sem pagamentos</strong><p>Os contratos e parcelas registados aparecerão aqui.</p></div>
          ) : (
            <div className="payment-list">
              {payments.map((payment) => (
                <article className="payment-row" key={payment.id}>
                  <div className="payment-info">
                    <strong>{payment.contract.student.name}</strong>
                    <span>{money(payment.amount)} · vence {dateLabel(payment.dueDate)}</span>
                    <small>Contrato {payment.contract.cycle === 'MONTHS_3' ? '3' : payment.contract.cycle === 'MONTHS_6' ? '6' : '12'} meses</small>
                  </div>
                  <div className="payment-actions">
                    <span className={`status-pill ${payment.paymentStatus === 'CONFIRMED' ? 'active' : payment.paymentStatus === 'OVERDUE' ? 'overdue' : ''}`}>
                      {payment.paymentStatus === 'CONFIRMED' ? 'Pago' : payment.paymentStatus === 'OVERDUE' ? 'Em atraso' : payment.paymentStatus === 'PENDING' ? 'Pendente' : payment.paymentStatus}
                    </span>
                    {payment.paymentStatus !== 'CONFIRMED' && payment.paymentStatus !== 'CANCELLED' && (
                      <button className="text-button accent" type="button" disabled={workingPaymentId === payment.id} onClick={() => void confirmPayment(payment.id)}>
                        {workingPaymentId === payment.id ? 'A confirmar…' : 'Confirmar pagamento'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
