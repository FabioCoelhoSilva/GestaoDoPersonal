'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  studentWorkoutService,
  type StudentRecord,
} from '@/lib/api/student-workout.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

export default function StudentsPage() {
  const { session, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      setStudents(await studentWorkoutService.listStudents());
      setError(null);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar os alunos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && session) void loadStudents();
  }, [authLoading, loadStudents, session]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-PT');
    if (!query) return students;
    return students.filter((student) =>
      `${student.name} ${student.email}`.toLocaleLowerCase('pt-PT').includes(query),
    );
  }, [search, students]);

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const student = await studentWorkoutService.createStudent({ name: name.trim(), email: email.trim() });
      setStudents((current) => [...current, student]);
      setName('');
      setEmail('');
      setSuccess(`${student.name} foi adicionado(a) à sua lista de alunos.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o aluno.');
    } finally {
      setSaving(false);
    }
  }

  function startEditing(student: StudentRecord) {
    setEditingId(student.id);
    setEditName(student.name);
    setEditEmail(student.email);
    setError(null);
    setSuccess(null);
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await studentWorkoutService.updateStudent(editingId, {
        name: editName.trim(),
        email: editEmail.trim(),
      });
      setStudents((current) => current.map((student) => student.id === updated.id ? updated : student));
      setEditingId(null);
      setSuccess('Os dados do aluno foram atualizados.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o aluno.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivateStudent(student: StudentRecord) {
    if (!window.confirm(`Desativar ${student.name}? O histórico será preservado.`)) return;
    setError(null);
    setSuccess(null);
    try {
      const updated = await studentWorkoutService.deactivateStudent(student.id);
      setStudents((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setSuccess(`${student.name} foi desativado(a). O histórico continua preservado.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível desativar o aluno.');
    }
  }

  return (
    <WorkspaceShell title="Alunos" eyebrow="Adicione e acompanhe os alunos associados ao seu tenant.">
      <div className="workspace-toolbar">
        <div><span className="metric-value">{students.filter((student) => student.active).length}</span><span className="toolbar-caption"> ativos</span></div>
        <label className="workspace-search">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar alunos..." aria-label="Pesquisar alunos" />
        </label>
      </div>

      <div className="workspace-content-grid">
        <section className="form-panel">
          <div className="panel-heading"><span className="panel-kicker">NOVO REGISTO</span><h2>Adicionar aluno</h2><p>Preencha os dados de contacto para criar o registo.</p></div>
          <form className="workspace-form" onSubmit={createStudent}>
            <label htmlFor="student-name">Nome completo</label>
            <input id="student-name" value={name} onChange={(event) => setName(event.target.value)} minLength={1} maxLength={200} required placeholder="Ex.: Joana Silva" />
            <label htmlFor="student-email">Email</label>
            <input id="student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required placeholder="joana@exemplo.com" />
            <button className="button button-primary" disabled={saving}>{saving ? 'A guardar…' : '+ Adicionar aluno'}</button>
          </form>
        </section>

        <section className="list-panel" aria-label="Lista de alunos">
          <div className="panel-heading list-heading"><div><span className="panel-kicker">A SUA COMUNIDADE</span><h2>Todos os alunos</h2></div><span className="count-badge">{filteredStudents.length}</span></div>
          {error && <p className="inline-message error" role="alert">{error}</p>}
          {success && <p className="inline-message success" role="status">{success}</p>}
          {loading ? <div className="list-loading"><span className="spinner" />A carregar alunos…</div> :
            filteredStudents.length === 0 ? (
              <div className="list-empty"><span aria-hidden="true">♙</span><strong>{search ? 'Nenhum resultado' : 'Ainda não tem alunos'}</strong><p>{search ? 'Experimente outro nome ou email.' : 'Adicione o primeiro aluno através do formulário.'}</p></div>
            ) : (
              <div className="student-list">
                {filteredStudents.map((student) => (
                  <article className={`student-row ${!student.active ? 'inactive' : ''}`} key={student.id}>
                    {editingId === student.id ? (
                      <form className="inline-edit-form" onSubmit={saveStudent}>
                        <input aria-label="Nome do aluno" value={editName} onChange={(event) => setEditName(event.target.value)} required maxLength={200} />
                        <input aria-label="Email do aluno" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required maxLength={320} />
                        <div className="row-actions">
                          <button className="text-button accent" disabled={saving}>Guardar</button>
                          <button type="button" className="text-button" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="student-avatar" aria-hidden="true">{student.name.slice(0, 1).toUpperCase()}</div>
                        <div className="student-info"><strong>{student.name}</strong><span>{student.email}</span></div>
                        <span className={`status-pill ${student.active ? 'active' : 'inactive'}`}>{student.active ? 'Ativo' : 'Inativo'}</span>
                        {student.active && <div className="row-actions">
                          <button className="text-button" onClick={() => startEditing(student)}>Editar</button>
                          <button className="text-button danger" onClick={() => void deactivateStudent(student)}>Desativar</button>
                        </div>}
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
