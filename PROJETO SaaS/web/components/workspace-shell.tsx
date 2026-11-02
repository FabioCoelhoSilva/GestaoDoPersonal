'use client';

import Link from 'next/link';
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-provider';

export function WorkspaceShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { session, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, router, session]);

  if (loading || !session) {
    return <main className="loading-screen"><span className="spinner" />A carregar o seu espaço…</main>;
  }

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
          <Link className="side-link" href="/dashboard"><span aria-hidden="true">◫</span> Visão geral</Link>
          <Link className={`side-link ${title === 'Alunos' ? 'active' : ''}`} href="/dashboard/students"><span aria-hidden="true">♙</span> Alunos</Link>
          <Link className={`side-link ${title === 'Treinos' ? 'active' : ''}`} href="/dashboard/workouts"><span aria-hidden="true">▤</span> Treinos</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="user-meta"><strong>{displayName}</strong><span>Personal Trainer</span></div>
          <button
            className="icon-button"
            aria-label="Terminar sessão"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
          >↗</button>
        </div>
      </aside>
      <section className="dashboard-main workspace-main">
        <header className="topbar">
          <div><p className="eyebrow">IMPETUS · O SEU ESPAÇO DE EVOLUÇÃO</p><h1>{title}</h1></div>
          <Link className="button button-quiet" href="/dashboard">← <span>Visão geral</span></Link>
        </header>
        <p className="workspace-intro">{eyebrow}</p>
        {children}
        <footer className="dashboard-footer">Impetus: A evolução que não para<span>Feito para acompanhar o seu progresso.</span></footer>
      </section>
    </main>
  );
}
