import { Router, Request, Response } from 'express';
import { WorkoutService, CreateWorkoutSheetInput } from './workout.service';

const router = Router();
const workoutService = new WorkoutService();

/**
 * Rota POST para criar uma nova ficha de treino
 * Endpoint: POST /api/workouts
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const input: CreateWorkoutSheetInput = req.body;

        // Executa a validação e formatação através do nosso serviço
        const payload = workoutService.buildWorkoutPayload(input);

        // Aqui, posteriormente, fará a persistência na base de dados (schema.sql)
        
        return res.status(201).json({
            success: true,
            message: "Ficha de treino validada e preparada com sucesso!",
            data: payload
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            error: error.message || "Erro ao processar a ficha de treino."
        });
    }
});

export default router;