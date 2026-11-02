'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Message = { id: number; role: 'assistant' | 'user'; text: string };

function getDestination(message: string) {
  const text = message.toLocaleLowerCase('pt-PT');
  if (/alun|cliente|estudante/.test(text)) {
    return { label: 'Abrir alunos', href: '/dashboard/students' };
  }
  if (/trein|exerc|hipertrof|força|forca|plano/.test(text)) {
    return { label: 'Abrir treinos', href: '/dashboard/workouts' };
  }
  if (/subscri|assinatura|pagamento|billing|fatura/.test(text)) {
    return { label: 'Ver subscrição', href: '/dashboard#billing' };
  }
  return null;
}

export function ImpetusCoach() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'Olá! Posso ajudar a encontrar alunos, treinos ou a informação da sua subscrição. A ligação ao assistente de IA está a ser preparada.',
    },
  ]);
  const nextId = useRef(1);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const destination = getDestination(text);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', text },
      {
        id: nextId.current++,
        role: 'assistant',
        text: destination
          ? `Posso encaminhar para a secção de ${destination.label.replace('Abrir ', '').replace('Ver ', '')}. A criação e edição diretamente por chat ficará disponível quando a IA estiver ligada.`
          : 'Ainda não consigo executar esse pedido: o motor de IA não está ligado. Experimente perguntar por alunos, treinos ou subscrição.',
      },
    ]);
    setDraft('');
  }

  function openDestination(text: string) {
    const destination = getDestination(text);
    if (!destination) return;
    setOpen(false);
    router.push(destination.href);
  }

  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <div className="coach-root">
      {open && (
        <>
          <button className="coach-backdrop" type="button" aria-label="Fechar assistente" onClick={() => setOpen(false)} />
          <aside
            id="impetus-coach-panel"
            className="coach-panel"
            aria-label="Impetus Coach"
            aria-modal="true"
            role="dialog"
            tabIndex={-1}
            ref={panelRef}
          >
            <header className="coach-header">
              <span className="coach-avatar" aria-hidden="true">✦</span>
              <div>
                <strong>Impetus Coach</strong>
                <span><i /> Fundamento em preparação</span>
              </div>
              <button type="button" className="coach-close" onClick={() => setOpen(false)} aria-label="Fechar chat">×</button>
            </header>
            <div className="coach-context">
              <span aria-hidden="true">✧</span>
              <p>As suas conversas são privadas. A IA ainda não está ligada a este espaço.</p>
            </div>
            <div className="coach-messages" aria-live="polite">
              {messages.map((message) => (
                <div className={`coach-message ${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <span className="coach-message-mark" aria-hidden="true">✦</span>}
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
            <div className="coach-suggestions">
              <span>ATALHOS</span>
              <button type="button" onClick={() => openDestination('alunos')}>Ver alunos <span>↗</span></button>
              <button type="button" onClick={() => openDestination('treinos')}>Abrir treinos <span>↗</span></button>
              <button type="button" onClick={() => openDestination('subscrição')}>Subscrição <span>↗</span></button>
            </div>
            <form className="coach-form" onSubmit={sendMessage}>
              <label className="visually-hidden" htmlFor="coach-message">Escrever mensagem para o Impetus Coach</label>
              <textarea
                id="coach-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Pergunte sobre alunos, treinos..."
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensagem">↑</button>
            </form>
            <p className="coach-footnote">Impetus: A evolução que não para</p>
          </aside>
        </>
      )}
      <button
        className={`coach-launcher ${open ? 'is-open' : ''}`}
        type="button"
        aria-label={open ? 'Fechar Impetus Coach' : 'Abrir Impetus Coach'}
        aria-expanded={open}
        aria-controls="impetus-coach-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="coach-launcher-spark" aria-hidden="true">{open ? '×' : '✦'}</span>
        {!open && <span className="coach-launcher-label">Impetus Coach</span>}
      </button>
    </div>
  );
}
