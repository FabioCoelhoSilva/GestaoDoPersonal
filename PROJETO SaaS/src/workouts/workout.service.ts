// Serviço de Gestão de Fichas de Treino (Workout-Sheet)

export interface WorkoutExerciseInput {
    exerciseId: number;
    sets: number;
    reps: string;
    weight?: number;
    notes?: string;
}

export interface CreateWorkoutSheetInput {
    studentId: number;
    title: string;
    description?: string;
    weekDay: string;
    exercises: WorkoutExerciseInput[];
}

export class WorkoutService {
    
    /**
     * Valida os dados de entrada para uma nova ficha de treino
     */
    public validateWorkoutSheet(input: CreateWorkoutSheetInput): boolean {
        if (!input.studentId || !input.title || !input.weekDay) {
            throw new Error("Campos obrigatórios em falta: aluno, título e dia da semana são necessários.");
        }
        if (!input.exercises || input.exercises.length === 0) {
            throw new Error("A ficha de treino deve conter pelo menos um exercício associado.");
        }
        return true;
    }

    /**
     * Simula a preparação do objeto para persistência na base de dados (schema.sql)
     */
    public buildWorkoutPayload(input: CreateWorkoutSheetInput) {
        this.validateWorkoutSheet(input);
        
        return {
            student_id: input.studentId,
            title: input.title,
            description: input.description || "",
            week_day: input.weekDay,
            total_exercises: input.exercises.length,
            exercises: input.exercises
        };
    }
}