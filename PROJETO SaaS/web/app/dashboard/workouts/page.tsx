'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  studentWorkoutService,
  type StudentRecord,
  type WorkoutDay,
  type WorkoutExerciseInput,
  type WorkoutRecord,
} from '@/lib/api/student-workout.service';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useAuth } from '@/lib/auth/auth-provider';

type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  gifUrl: string;
};

const emptyExercise = (): ExerciseDraft => ({ name: '', sets: '3', reps: '10', restSeconds: '60', gifUrl: '' });
const workoutDays: { value: WorkoutDay; label: string }[] = [
  { value: 'MONDAY', label: 'Seg' },
  { value: 'TUESDAY', label: 'Ter' },
  { value: 'WEDNESDAY', label: 'Qua' },
  { value: 'THURSDAY', label: 'Qui' },
  { value: 'FRIDAY', label: 'Sex' },
  { value: 'SATURDAY', label: 'Sáb' },
  { value: 'SUNDAY', label: 'Dom' },
];

export default function WorkoutsPage() {
  const { session, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trainingDays, setTrainingDays] = useState<WorkoutDay[]>([]);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([emptyExercise()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [studentsResult, workoutsResult] = await Promise.allSettled([
      studentWorkoutService.listStudents(),
      studentWorkoutService.listWorkouts(),
    ]);

    if (studentsResult.status === 'fulfilled') {
      const allStudents = studentsResult.value;
      const activeStudents = allStudents.filter((student) => student.active);
      setStudents(activeStudents);
      setStudentId((current) => current || activeStudents[0]?.id || '');
    }
    if (workoutsResult.status === 'fulfilled') setWorkouts(workoutsResult.value);

    const failures = [studentsResult, workoutsResult].filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      const reason = failures[0].status === 'rejected' ? failures[0].reason : null;
      setError(reason instanceof ApiError ? reason.message : 'Não foi possível carregar os dados de treinos.');
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && session) void loadData();
  }, [authLoading, loadData, session]);

  function updateExercise(index: number, field: keyof ExerciseDraft, value: string) {
    setExercises((current) => current.map((exercise, currentIndex) =>
      currentIndex === index ? { ...exercise, [field]: value } : exercise,
    ));
  }

  async function createWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payloadExercises: WorkoutExerciseInput[] = exercises.map((exercise, index) => ({
      name: exercise.name.trim(),
      sets: Number(exercise.sets),
      reps: exercise.reps.trim(),
      restSeconds: exercise.restSeconds ? Number(exercise.restSeconds) : null,
      order: index,
      ...(exercise.gifUrl.trim() ? { gifUrl: exercise.gifUrl.trim() } : {}),
    }));

    try {
      const workout = await studentWorkoutService.createWorkout({
        studentId,
        title: title.trim(),
        description: description.trim() || null,
        trainingDays,
        exercises: payloadExercises,
      });
      setWorkouts((current) => [workout, ...current]);
      setTitle('');
      setDescription('');
      setTrainingDays([]);
      setExercises([emptyExercise()]);
      setSuccess(`O treino “${workout.title}” foi criado com ${workout.exercises.length} exercício(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar o treino.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveWorkout(workout: WorkoutRecord) {
    if (!window.confirm(`Arquivar o treino “${workout.title}”? O histórico e os exercícios serão preservados.`)) return;
    setError(null);
    try {
      const updated = await studentWorkoutService.archiveWorkout(workout.id);
      setWorkouts((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setSuccess(`O treino “${workout.title}” foi arquivado.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível arquivar o treino.');
    }
  }

  const studentName = (id: string) => students.find((student) => student.id === id)?.name ?? 'Aluno';

  return (
    <WorkspaceShell title="Treinos" eyebrow="Monte planos simples por aluno, com séries, repetições, descanso e GIF opcional.">
      {error && <p className="inline-message error page-message" role="alert">{error}</p>}
      {success && <p className="inline-message success page-message" role="status">{success}</p>}
      <div className="workspace-content-grid workout-layout">
        <section className="form-panel workout-form-panel">
          <div className="panel-heading"><span className="panel-kicker">NOVO PLANO</span><h2>Montar treino</h2><p>Escolha um aluno e adicione um ou mais exercícios.</p></div>
          {students.length === 0 && !loading ? (
            <div className="list-empty compact"><span aria-hidden="true">♙</span><strong>Adicione um aluno primeiro</strong><p>O plano precisa de um aluno ativo associado.</p><a className="text-link" href="/dashboard/students">Ir para alunos ↗</a></div>
          ) : (
            <form className="workspace-form" onSubmit={createWorkout}>
              <label htmlFor="workout-student">Aluno</label>
              <select id="workout-student" value={studentId} onChange={(event) => setStudentId(event.target.value)} required disabled={students.length === 0}>
                {students.length === 0 && <option value="">A carregar alunos…</option>}
                {students.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}
              </select>
              <label htmlFor="workout-title">Nome do treino</label>
              <input id="workout-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} placeholder="Ex.: Treino A — membros inferiores" />
              <label htmlFor="workout-description">Descrição <span className="optional-label">opcional</span></label>
              <textarea id="workout-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} placeholder="Objetivo ou instruções gerais" />

              <fieldset className="training-days-fieldset">
                <legend>Dias de treino <span className="optional-label">selecione pelo menos um</span></legend>
                <div className="training-days-options">
                  {workoutDays.map((day) => (
                    <label className="training-day-option" key={day.value}>
                      <input
                        type="checkbox"
                        checked={trainingDays.includes(day.value)}
                        onChange={(event) => setTrainingDays((current) =>
                          event.target.checked
                            ? [...current, day.value]
                            : current.filter((value) => value !== day.value),
                        )}
                      />
                      <span>{day.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="exercise-section-heading"><div><span className="panel-kicker">EXERCÍCIOS</span><strong>{exercises.length} no plano</strong></div><button type="button" className="text-button accent" onClick={() => setExercises((current) => [...current, emptyExercise()])}>+ Adicionar</button></div>
              <div className="exercise-draft-list">
                {exercises.map((exercise, index) => (
                  <fieldset className="exercise-draft" key={index}>
                    <legend>Exercício {index + 1}</legend>
                    {exercises.length > 1 && <button type="button" className="remove-exercise" aria-label={`Remover exercício ${index + 1}`} onClick={() => setExercises((current) => current.filter((_, currentIndex) => currentIndex !== index))}>×</button>}
                    <label htmlFor={`exercise-name-${index}`}>Nome</label>
                    <input id={`exercise-name-${index}`} value={exercise.name} onChange={(event) => updateExercise(index, 'name', event.target.value)} required maxLength={200} placeholder="Ex.: Agachamento" />
                    <div className="exercise-numbers">
                      <div><label htmlFor={`exercise-sets-${index}`}>Séries</label><input id={`exercise-sets-${index}`} type="number" min={1} max={100} value={exercise.sets} onChange={(event) => updateExercise(index, 'sets', event.target.value)} required /></div>
                      <div><label htmlFor={`exercise-reps-${index}`}>Repetições</label><input id={`exercise-reps-${index}`} value={exercise.reps} onChange={(event) => updateExercise(index, 'reps', event.target.value)} required maxLength={32} placeholder="8-12" /></div>
                      <div><label htmlFor={`exercise-rest-${index}`}>Descanso (s)</label><input id={`exercise-rest-${index}`} type="number" min={0} max={7200} value={exercise.restSeconds} onChange={(event) => updateExercise(index, 'restSeconds', event.target.value)} /></div>
                    </div>
                    <label htmlFor={`exercise-gif-${index}`}>URL de demonstração <span className="optional-label">opcional · HTTPS</span></label>
                    <input id={`exercise-gif-${index}`} type="url" pattern="https://.*" value={exercise.gifUrl} onChange={(event) => updateExercise(index, 'gifUrl', event.target.value)} placeholder="https://exemplo.com/exercicio.gif" />
                  </fieldset>
                ))}
              </div>
              <button className="button button-primary" disabled={saving || students.length === 0 || trainingDays.length === 0}>{saving ? 'A criar treino…' : 'Criar plano de treino'}</button>
            </form>
          )}
        </section>

        <section className="list-panel workout-list-panel" aria-label="Treinos existentes">
          <div className="panel-heading list-heading"><div><span className="panel-kicker">PLANOS</span><h2>Treinos recentes</h2></div><span className="count-badge">{workouts.filter((workout) => workout.active).length} ativos</span></div>
          {loading ? <div className="list-loading"><span className="spinner" />A carregar treinos…</div> :
            workouts.length === 0 ? (
              <div className="list-empty"><span aria-hidden="true">▤</span><strong>Ainda não há treinos</strong><p>Os planos que criar vão aparecer aqui.</p></div>
            ) : (
              <div className="workout-list">
                {workouts.map((workout) => (
                  <article className={`workout-card ${!workout.active ? 'inactive' : ''}`} key={workout.id}>
                    <div className="workout-card-heading">
                      <div><span className="workout-student">{studentName(workout.studentId)}</span><h3>{workout.title}</h3></div>
                      <span className={`status-pill ${workout.active ? 'active' : 'inactive'}`}>{workout.active ? 'Ativo' : 'Arquivado'}</span>
                    </div>
                    {workout.description && <p className="workout-description">{workout.description}</p>}
                    {workout.trainingDays.length > 0 && (
                      <div className="workout-training-days" aria-label="Dias de treino">
                        {workoutDays.filter((day) => workout.trainingDays.includes(day.value)).map((day) => <span key={day.value}>{day.label}</span>)}
                      </div>
                    )}
                    <div className="workout-exercise-list">
                      {workout.exercises.map((exercise) => (
                        <div className="workout-exercise" key={exercise.id}>
                          <span className="exercise-order">{String(exercise.order + 1).padStart(2, '0')}</span>
                          <div><strong>{exercise.name}</strong><span>{exercise.sets} séries · {exercise.reps} reps{exercise.restSeconds !== null ? ` · ${exercise.restSeconds}s descanso` : ''}</span></div>
                          {exercise.gifUrl && <a className="gif-link" href={exercise.gifUrl} target="_blank" rel="noreferrer">Ver GIF ↗</a>}
                        </div>
                      ))}
                    </div>
                    {workout.active && <div className="workout-card-actions"><button className="text-button danger" onClick={() => void archiveWorkout(workout)}>Arquivar treino</button></div>}
                  </article>
                ))}
              </div>
            )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
