import { Router, Request, Response } from 'express';
import { StudentService } from './student.service';

const router = Router();
const studentService = new StudentService();

/**
 * Rota POST para criar um novo aluno
 * Endpoint: POST /api/students
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        // Assume que o ID do Personal Trainer autenticado vem injetado no req.auth ou req.body
        const personalId = req.auth?.userId || req.body.personalId;
        const { name, email, phone } = req.body;

        const newStudent = await studentService.createStudent({
            personalId: Number(personalId),
            name,
            email,
            phone
        });

        return res.status(201).json({
            success: true,
            message: "Aluno registado com sucesso!",
            data: newStudent
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            error: error.message || "Erro ao registar o aluno."
        });
    }
});

/**
 * Rota GET para listar os alunos do Personal Trainer
 * Endpoint: GET /api/students
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const personalId = req.auth?.userId || req.query.personalId;

        if (!personalId) {
            return res.status(400).json({
                success: false,
                error: "ID do personal trainer não fornecido."
            });
        }

        const students = await studentService.getStudentsByPersonal(Number(personalId));

        return res.status(200).json({
            success: true,
            data: students
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message || "Erro ao listar os alunos."
        });
    }
});

export default router;