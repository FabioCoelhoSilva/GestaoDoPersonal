'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const destinations = [
  {
    title: 'Alunos',
    description: 'Consultar e acompanhar os seus alunos',
    href: '/dashboard/students',
    keywords: ['aluno', 'alunos', 'cliente', 'clientes', 'estudante'],
    icon: '♙',
  },
  {
    title: 'Treinos',
    description: 'Abrir os planos de treino',
    href: '/dashboard/workouts',
    keywords: ['treino', 'treinos', 'plano', 'exercício', 'exercicios', 'hipertrofia', 'criar'],
    icon: '▤',
  },
  {
    title: 'Subscrição',
    description: 'Ver o seu plano e estado de acesso',
    href: '/dashboard#billing',
    keywords: ['subscrição', 'assinatura', 'plano', 'billing', 'pagamento', 'faturação'],
    icon: '◇',
  },
  {
    title: 'Pagamentos',
    description: 'Gerir contratos e mensalidades dos alunos',
    href: '/dashboard/payments',
    keywords: ['pagamento', 'pagamentos', 'mensalidade', 'mensalidades', 'cobrar', 'faturação', 'contrato'],
    icon: '€',
  },
  {
    title: 'Agenda',
    description: 'Agendar e acompanhar aulas',
    href: '/dashboard/appointments',
    keywords: ['agenda', 'aula', 'aulas', 'sessão', 'sessões', 'horário', 'marcar'],
    icon: '◷',
  },
];

export function CommandCenter() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-PT');
    if (!normalized) return destinations;
    return destinations.filter((destination) =>
      [destination.title, destination.description, ...destination.keywords].some((term) =>
        term.toLocaleLowerCase('pt-PT').includes(normalized) ||
        normalized.split(/\s+/).some((word) => word.length > 2 && term.toLocaleLowerCase('pt-PT').includes(word)),
      ),
    );
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (matches[0]) navigate(matches[0].href);
  }

  return (
    <section className="command-center" aria-label="Command Center Impetus">
      <div className="command-heading">
        <div>
          <p className="eyebrow">COMMAND CENTER</p>
          <h2>O que vamos fazer hoje?</h2>
        </div>
        <span className="command-shortcut" aria-hidden="true">⌘ K</span>
      </div>
      <form className="command-form" onSubmit={handleSubmit}>
        <span className="command-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          aria-label="Pesquisar uma ação"
          aria-expanded={open}
          aria-controls="command-results"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder="Experimente: criar treino de hipertrofia..."
        />
        <button type="submit" className="command-submit" disabled={matches.length === 0} aria-label="Abrir primeiro resultado">
          <span>Enter</span><span aria-hidden="true">↵</span>
        </button>
      </form>
      {open && (
        <div className="command-results" id="command-results" role="listbox" aria-label="Secções disponíveis">
          {matches.length > 0 ? matches.map((destination) => (
            <button
              type="button"
              className="command-result"
              key={destination.title}
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => navigate(destination.href)}
            >
              <span className="command-result-icon" aria-hidden="true">{destination.icon}</span>
              <span className="command-result-copy">
                <strong>{destination.title}</strong>
                <small>{destination.description}</small>
              </span>
              <span className="command-result-arrow" aria-hidden="true">↗</span>
            </button>
          )) : (
            <p className="command-no-results">Ainda não encontrei uma secção para este pedido.</p>
          )}
          <p className="command-hint">Navegue ou execute tarefas de gestão diretamente</p>
        </div>
      )}
      {!open && (
        <div className="command-prompts" aria-label="Sugestões">
          {['Criar treino', 'Ver alunos', 'Ver agenda', 'Consultar pagamentos'].map((prompt) => (
            <button
              className="prompt-chip"
              type="button"
              key={prompt}
              onClick={() => {
                setQuery(prompt);
                setOpen(true);
              }}
            >
              <span aria-hidden="true">✦</span>{prompt}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
