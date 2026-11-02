import { apiRequest } from '@/lib/api/client';

export type StudentRecord = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudentInput = Pick<StudentRecord, 'name' | 'email'>;
export type StudentUpdate = Partial<StudentInput>;

export type WorkoutExerciseInput = {
  name: string;
  gifUrl?: string | null;
  sets: number;
  reps: string;
  restSeconds?: number | null;
  order: number;
  notes?: string | null;
};

export type WorkoutDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type WorkoutExerciseRecord = WorkoutExerciseInput & {
  id: string;
  workoutId: string;
  personalId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkoutRecord = {
  id: string;
  studentId: string;
  personalId: string;
  title: string;
  description: string | null;
  trainingDays: WorkoutDay[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutExerciseRecord[];
};

export type WorkoutInput = {
  studentId: string;
  title: string;
  description?: string | null;
  trainingDays: WorkoutDay[];
  exercises: WorkoutExerciseInput[];
};

export const studentWorkoutService = {
  listStudents: () => apiRequest<StudentRecord[]>('students'),
  createStudent: (input: StudentInput) =>
    apiRequest<StudentRecord>('students', { method: 'POST', body: input }),
  updateStudent: (studentId: string, input: StudentUpdate) =>
    apiRequest<StudentRecord>(`students/${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: input,
    }),
  deactivateStudent: (studentId: string) =>
    apiRequest<StudentRecord>(`students/${encodeURIComponent(studentId)}`, { method: 'DELETE' }),
  listWorkouts: () => apiRequest<WorkoutRecord[]>('workouts'),
  createWorkout: (input: WorkoutInput) =>
    apiRequest<WorkoutRecord>('workouts', { method: 'POST', body: input }),
  archiveWorkout: (workoutId: string) =>
    apiRequest<WorkoutRecord>(`workouts/${encodeURIComponent(workoutId)}`, { method: 'DELETE' }),
};
