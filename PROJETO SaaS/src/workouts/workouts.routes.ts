import { Router } from 'express';

const router = Router();

// Base de dados temporária em memória para treinos (será ligada ao Prisma/Supabase em breve)
const workoutsList = [
  {
    id: '1',
    studentId: '1',
    title: 'Treino A - Membros Superiores (Hipertrofia)',
    description: 'Foco em peitoral, ombros e tríceps com sobrecarga progressiva.',
    exercises: [
      { name: 'Supreto Reto com Anilha / Barra', sets: 4, reps: '8-10', rpe: '9' },
      { name: 'Desenvolvimento Militar', sets: 3, reps: '10-12', rpe: '8' }
    ],
    status: 'Ativo'
  }
];

// GET: Listar todos os planos de treino
router.get('/', (req, res) => {
  return res.json(workoutsList);
});

// POST: Criar um novo plano de treino
router.post('/', (req, res) => {
  const { studentId, title, description, exercises } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'O título do plano de treino é obrigatório.' });
  }

  const newWorkout = {
    id: Date.now().toString(),
    studentId: studentId || '1',
    title,
    description: description || 'Plano prescrito via Impetus IA',
    exercises: exercises || [],
    status: 'Ativo',
  };

  workoutsList.push(newWorkout);
  return res.status(201).json(newWorkout);
});

export default router;
