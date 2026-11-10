'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setSubmitting(false);
      setErrorMessage('Não foi possível iniciar sessão. Verifique o email e a palavra-passe.');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    window.location.assign('/treinos');
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre na sua conta para acompanhar o seu negócio."
      footer={<>Ainda não tem conta? <Link href="/register">Criar conta</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
        />
        <div className="label-row">
          <label htmlFor="password">Palavra-passe</label>
          <span className="label-hint">Mínimo de 8 caracteres</span>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="A sua palavra-passe"
        />
        {errorMessage && <p className="form-message error" role="alert">{errorMessage}</p>}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'A entrar…' : 'Entrar na conta'}
        </button>
      </form>
    </AuthShell>
  );
}
