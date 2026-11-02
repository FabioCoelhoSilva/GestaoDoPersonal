'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, getBillingOverview, getDashboardMetrics, type BillingOverview, type DashboardMetrics } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { CommandCenter } from '@/components/command-center';

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: string;
  tone: 'green' | 'blue' | 'orange' | 'purple';
}) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`} aria-hidden="true">{icon}</div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { session, loading: authLoading, signOut } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [metricsError, setMetricsError] = useState<ApiError | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    const [metricsResult, billingResult] = await Promise.allSettled([
      getDashboardMetrics(),
      getBillingOverview(),
    ]);

    if (metricsResult.status === 'fulfilled') {
      setMetrics(metricsResult.value);
      setMetricsError(null);
    } else {
      setMetrics(null);
      setMetricsError(
        metricsResult.reason instanceof ApiError
          ? metricsResult.reason
          : new ApiError('Não foi possível carregar as métricas.', 500, null),
      );
    }

    if (billingResult.status === 'fulfilled') {
      setBilling(billingResult.value);
      setBillingError(null);
    } else {
      setBilling(null);
      setBillingError(
        billingResult.reason instanceof Error
          ? billingResult.reason.message
          : 'Não foi possível consultar a subscrição.',
      );
    }
    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    void loadDashboard();
  }, [authLoading, session, router, loadDashboard]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setSigningOut(false);
      setBillingError('Não foi possível terminar a sessão. Tente novamente.');
    }
  }

  if (authLoading || pageLoading || !session) {
    return <main className="loading-screen"><span className="spinner" />A carregar o seu espaço…</main>;
  }

  const subscriptionDenied = metricsError?.status === 402;
  const accountNotProvisioned = metricsError?.status === 403;
  const displayName = session.user.email?.split('@')[0] ?? 'Personal';

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <Link className="brand sidebar-brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>impetus<span className="brand-light">.</span></span>
        </Link>
        <div className="sidebar-section-label">MENU PRINCIPAL</div>
        <nav className="side-nav" aria-label="Menu principal">
          <a className="side-link active" href="#overview"><span aria-hidden="true">◫</span> Visão geral</a>
          <Link className="side-link" href="/dashboard/students"><span aria-hidden="true">♙</span> Alunos</Link>
          <Link className="side-link" href="/dashboard/workouts"><span aria-hidden="true">▤</span> Treinos</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="user-meta">
            <strong>{displayName}</strong>
            <span>Personal Trainer</span>
          </div>
          <button className="icon-button" onClick={handleSignOut} disabled={signingOut} aria-label="Terminar sessão">
            ↗
          </button>
        </div>
      </aside>

      <section className="dashboard-main" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">IMPETUS · O SEU ESPAÇO DE EVOLUÇÃO</p>
            <h1>O seu próximo passo começa aqui.</h1>
          </div>
          <button className="button button-quiet" onClick={() => void loadDashboard()}>↻ <span>Atualizar</span></button>
        </header>

        {accountNotProvisioned && (
          <div className="alert alert-warning" role="alert">
            <strong>Não foi possível validar o acesso ao espaço</strong>
            <p>{metricsError?.message} Confirme que o seu perfil de personal foi provisionado ou contacte o suporte.</p>
          </div>
        )}
        {subscriptionDenied && (
          <div className="alert alert-warning" role="alert">
            <strong>Subscrição necessária</strong>
            <p>{metricsError?.message} Ative ou regularize a subscrição para consultar os recursos do dashboard.</p>
          </div>
        )}
        {billing && !billing.accessAllowed && !subscriptionDenied && (
          <div className="alert alert-warning" role="status">
            <strong>A subscrição não está ativa</strong>
            <p>{billing.subscription ? `Estado atual: ${billing.subscription.status}.` : 'Ainda não existe uma subscrição associada a este tenant.'} As métricas protegidas ficam indisponíveis até o acesso ser regularizado.</p>
          </div>
        )}
        {billingError && !accountNotProvisioned && (
          <div className="alert alert-error" role="alert">{billingError}</div>
        )}

        <div className="welcome-panel">
          <div>
            <span className="welcome-tag">O SEU ESPAÇO DE EVOLUÇÃO</span>
            <h2>Olá, {displayName}. <span aria-hidden="true">✦</span></h2>
            <p>Pequenos passos. Grandes mudanças. Vamos começar?</p>
          </div>
          <div className="welcome-art" aria-hidden="true"><span>✦</span><span>↗</span><span>●</span></div>
        </div>

        <CommandCenter />

        <div className="section-heading">
          <div>
            <p className="eyebrow">ACOMPANHAMENTO EM TEMPO REAL</p>
            <h2>Resumo do negócio</h2>
          </div>
          {billing?.plan && <span className="plan-badge">{billing.plan.name}</span>}
        </div>

        {metrics ? (
          <div className="metric-grid">
            <MetricCard label="Alunos ativos" value={metrics.activeStudents} detail="Alunos com acompanhamento ativo" icon="♙" tone="green" />
            <MetricCard label="Planos de treino" value={metrics.workoutPlans} detail="Planos criados para os seus alunos" icon="▤" tone="blue" />
            <MetricCard label="Sessões concluídas" value={metrics.sessions.executed} detail="Treinos finalizados" icon="✓" tone="orange" />
            <MetricCard label="Em andamento" value={metrics.sessions.inProgress} detail={`${metrics.sessions.total} sessões no total`} icon="◷" tone="purple" />
          </div>
        ) : !accountNotProvisioned && !subscriptionDenied ? (
          <div className="empty-panel">
            <span className="empty-icon" aria-hidden="true">⌁</span>
            <h3>Não foi possível carregar as métricas</h3>
            <p>{metricsError?.message ?? 'Verifique a ligação à API e tente novamente.'}</p>
            <button className="button button-primary button-small" onClick={() => void loadDashboard()}>Tentar novamente</button>
          </div>
        ) : (
          <div className="empty-panel subdued">
            <span className="empty-icon" aria-hidden="true">⌁</span>
            <h3>Métricas indisponíveis</h3>
            <p>Os dados serão apresentados quando o acesso ao tenant e à subscrição estiver regularizado.</p>
          </div>
        )}
        <div className="workspace-sections">
          <section className="workspace-card" id="students">
            <div className="workspace-card-icon mint" aria-hidden="true">♙</div>
            <div className="workspace-card-copy">
              <p className="eyebrow">ACOMPANHAMENTO</p>
              <h3>Os seus alunos</h3>
              <p>Consulte a sua atividade e mantenha cada percurso em evolução.</p>
            </div>
            <Link className="workspace-card-link" href="/dashboard/students">Gerir alunos ↗</Link>
          </section>
          <section className="workspace-card" id="workouts">
            <div className="workspace-card-icon violet" aria-hidden="true">▤</div>
            <div className="workspace-card-copy">
              <p className="eyebrow">PLANEAMENTO</p>
              <h3>Planos de treino</h3>
              <p>Estruture os próximos objetivos de treino dos seus alunos.</p>
            </div>
            <Link className="workspace-card-link" href="/dashboard/workouts">Montar treino ↗</Link>
          </section>
          <section className="workspace-card billing-card" id="billing">
            <div className="workspace-card-icon amber" aria-hidden="true">◇</div>
            <div className="workspace-card-copy">
              <p className="eyebrow">CONTA</p>
              <h3>Subscrição e plano</h3>
              <p>{billing?.plan ? `Plano ${billing.plan.name}` : 'Consulte o estado e os limites do seu plano.'}</p>
            </div>
            {billing?.subscription && <span className="section-status">{billing.subscription.status}</span>}
          </section>
        </div>
        <footer className="dashboard-footer">Impetus: A evolução que não para<span>Feito para acompanhar o seu progresso.</span></footer>
      </section>
    </main>
  );
}
