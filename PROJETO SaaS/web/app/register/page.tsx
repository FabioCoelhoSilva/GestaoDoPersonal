'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { provisionPersonal } from '@/lib/api/client';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);
    setSubmitting(true);

    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      setSubmitting(false);
      setErrorMessage('Não foi possível criar a conta. Verifique os dados ou tente novamente.');
      return;
    }
    if (!data.session) {
      setSubmitting(false);
      setNotice('Conta criada. Confirme o seu email e depois inicie sessão para concluir a ativação do espaço.');
      setPassword('');
      return;
    }

    try {
      await provisionPersonal(email);
      router.replace('/dashboard');
    } catch (error) {
      setSubmitting(false);
      setErrorMessage(
        error instanceof Error
          ? `A conta foi criada, mas não foi possível ativar o espaço: ${error.message}`
          : 'A conta foi criada, mas não foi possível ativar o espaço. Tente iniciar sessão novamente.',
      );
      return;
    }
    setSubmitting(false);
    setPassword('');
  }

  return (
    <AuthShell
      title="Crie a sua conta"
      description="Comece a organizar os seus alunos e planos de treino."
      footer={<>Já tem conta? <Link href="/login">Iniciar sessão</Link></>}
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
        <label htmlFor="password">Palavra-passe</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Pelo menos 8 caracteres"
        />
        {errorMessage && <p className="form-message error" role="alert">{errorMessage}</p>}
        {notice && <p className="form-message notice" role="status">{notice}</p>}
        <button className="button button-primary" type="submit" disabled={submitting}>
          {submitting ? 'A criar conta…' : 'Criar conta'}
        </button>
      </form>
    </AuthShell>
  );
}
