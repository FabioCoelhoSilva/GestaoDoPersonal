import type { ReactNode } from 'react';

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand" href="/" aria-label="Impetus - início">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span>impetus<span className="brand-light">.</span></span>
        </a>
        <div className="auth-heading">
          <p className="eyebrow">A EVOLUÇÃO QUE NÃO PARA</p>
          <h1 id="auth-title">{title}</h1>
          <p className="muted">{description}</p>
        </div>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
      <aside className="auth-aside">
        <div className="aside-glow" aria-hidden="true" />
        <span className="aside-kicker">TREINE. ACOMPANHE. EVOLUA.</span>
        <p>Mais foco nos seus alunos.<br />Menos tempo na gestão.</p>
        <span className="aside-note">Impetus: A evolução que não para.</span>
      </aside>
    </main>
  );
}
