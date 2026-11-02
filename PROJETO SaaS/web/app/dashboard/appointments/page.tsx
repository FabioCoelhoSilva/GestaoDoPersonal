'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { financialService, type AppointmentRecord } from '@/lib/api/financial.service';
import {
  studentWorkoutService,
  type StudentRecord,
  type WorkoutRecord,
} from '@/lib/api/student-workout.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

function localDateTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AppointmentsPage() {
  const { session, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [studentId, setStudentId] = useState('');
  const [workoutId, setWorkoutId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  const [endsAt, setEndsAt] = useState(() => localDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    const [studentsResult, workoutsResult, appointmentsResult] = await Promise.allSettled([
      studentWorkoutService.listStudents(),
      studentWorkoutService.listWorkouts(),
      financialService.listAppointments(from, to),
    ]);
    if (studentsResult.status === 'fulfilled') {
      const activeStudents = studentsResult.value.filter((student) => student.active);
      setStudents(activeStudents);
      setStudentId((current) => current || activeStudents[0]?.id || '');
    }
    if (workoutsResult.status === 'fulfilled') {
      const activeWorkouts = workoutsResult.value.filter((workout) => workout.active);
      setWorkouts(activeWorkouts);
    }
    if (appointmentsResult.status === 'fulfilled') setAppointments(appointmentsResult.value);
    const failure = [studentsResult, workoutsResult, appointmentsResult].find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      setError(failure.reason instanceof Error ? failure.reason.message : 'Não foi possível carregar a agenda.');
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && session) void loadData();
  }, [authLoading, loadData, session]);

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await financialService.createAppointment({
        studentId,
        ...(workoutId ? { workoutId } : {}),
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        notes: notes.trim() || null,
      });
      setAppointments((current) => [...current, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setTitle('');
      setNotes('');
      setWorkoutId('');
      setSuccess('Aula agendada. Os conflitos de horário são validados automaticamente.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível agendar a aula.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(appointmentId: string, status: 'COMPLETED' | 'CANCELLED') {
    setWorkingId(appointmentId);
    setError(null);
    setSuccess(null);
    try {
      const updated = await financialService.updateAppointmentStatus(appointmentId, status);
      setAppointments((current) => current.map((appointment) => appointment.id === updated.id ? updated : appointment));
      setSuccess(status === 'COMPLETED' ? 'Aula marcada como concluída.' : 'Aula cancelada.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o estado da aula.');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <WorkspaceShell title="Agenda" eyebrow="Agende aulas avulsas e acompanhe os horários dos seus alunos.">
      {error && <p className="inline-message error page-message" role="alert">{error}</p>}
      {success && <p className="inline-message success page-message" role="status">{success}</p>}
      <div className="workspace-content-grid appointment-layout">
        <section className="form-panel">
          <div className="panel-heading"><span className="panel-kicker">NOVA AULA</span><h2>Agendar sessão</h2><p>Os horários sobrepostos do personal são bloqueados.</p></div>
          {students.length === 0 && !loading ? (
            <div className="list-empty compact"><span aria-hidden="true">♙</span><strong>Sem alunos ativos</strong><p>Adicione um aluno para agendar uma aula.</p><a className="text-link" href="/dashboard/students">Ir para alunos ↗</a></div>
          ) : (
            <form className="workspace-form" onSubmit={createAppointment}>
              <label htmlFor="appointment-student">Aluno</label>
              <select
                id="appointment-student"
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  setWorkoutId('');
                }}
                required
              >
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
              <label htmlFor="appointment-workout">Plano de treino <span className="optional-label">opcional</span></label>
              <select
                id="appointment-workout"
                value={workoutId}
                onChange={(event) => setWorkoutId(event.target.value)}
                disabled={!workouts.some((workout) => workout.studentId === studentId)}
              >
                <option value="">Sessão sem plano associado</option>
                {workouts
                  .filter((workout) => workout.studentId === studentId)
                  .map((workout) => <option key={workout.id} value={workout.id}>{workout.title}</option>)}
              </select>
              <label htmlFor="appointment-title">Tipo de aula</label>
              <input id="appointment-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={160} placeholder="Ex.: Avaliação física" required />
              <label htmlFor="appointment-start">Início</label>
              <input id="appointment-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              <label htmlFor="appointment-end">Fim</label>
              <input id="appointment-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
              <label htmlFor="appointment-notes">Notas <span className="optional-label">opcional</span></label>
              <textarea id="appointment-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Instruções ou observações" />
              <button className="button button-primary" disabled={saving || !studentId}>{saving ? 'A agendar…' : 'Agendar aula'}</button>
            </form>
          )}
        </section>
        <section className="list-panel">
          <div className="panel-heading list-heading"><div><span className="panel-kicker">ÚLTIMOS 30 DIAS · PRÓXIMOS 90 DIAS</span><h2>Aulas agendadas</h2></div><span className="count-badge">{appointments.filter((appointment) => appointment.status === 'SCHEDULED').length} agendadas</span></div>
          {loading ? <div className="list-empty"><span aria-hidden="true">◷</span><strong>A carregar agenda…</strong></div> : appointments.length === 0 ? (
            <div className="list-empty"><span aria-hidden="true">◷</span><strong>Agenda livre</strong><p>As aulas agendadas aparecerão aqui.</p></div>
          ) : (
            <div className="appointment-list">
              {appointments.map((appointment) => (
                <article className="appointment-row" key={appointment.id}>
                  <div className="appointment-date" aria-hidden="true"><span>{new Intl.DateTimeFormat('pt-PT', { day: '2-digit' }).format(new Date(appointment.startsAt))}</span><small>{new Intl.DateTimeFormat('pt-PT', { month: 'short' }).format(new Date(appointment.startsAt))}</small></div>
                  <div className="appointment-info">
                    <strong>{appointment.title}</strong>
                    <span>{appointment.student.name}</span>
                    {appointment.workout && <span className="appointment-workout">Treino: {appointment.workout.title}</span>}
                    <small>{displayDate(appointment.startsAt)} – {new Intl.DateTimeFormat('pt-PT', { timeStyle: 'short' }).format(new Date(appointment.endsAt))}</small>
                    {appointment.notes && <p>{appointment.notes}</p>}
                  </div>
                  <div className="appointment-actions">
                    <span className={`status-pill ${appointment.status === 'COMPLETED' ? 'active' : appointment.status === 'CANCELLED' ? 'inactive' : ''}`}>
                      {appointment.status === 'SCHEDULED' ? 'Agendada' : appointment.status === 'COMPLETED' ? 'Concluída' : 'Cancelada'}
                    </span>
                    {appointment.status === 'SCHEDULED' && (
                      <div>
                        <button className="text-button accent" type="button" disabled={workingId === appointment.id} onClick={() => void changeStatus(appointment.id, 'COMPLETED')}>Concluir</button>
                        <button className="text-button danger" type="button" disabled={workingId === appointment.id} onClick={() => void changeStatus(appointment.id, 'CANCELLED')}>Cancelar</button>
                      </div>
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
