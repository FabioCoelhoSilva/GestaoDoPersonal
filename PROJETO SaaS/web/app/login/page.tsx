'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { provisionPersonal } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      setErrorMessage('Não foi possível iniciar sessão. Verifique o email e a palavra-passe.');
      return;
    }
    try {
      await provisionPersonal(email);
      router.replace('/dashboard');
    } catch (provisionError) {
      console.error('Não foi possível provisionar o espaço após o login.', provisionError);
      router.replace('/dashboard?onboarding=pending');
    }
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
