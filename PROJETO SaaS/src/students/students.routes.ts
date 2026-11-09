import { Router } from 'express';

const router = Router();

// Simulação de base de dados em memória para validação imediata do CRUD de Alunos
let studentsList = [
  { id: '1', name: 'Jacyara Lemos', email: 'jacyara@email.com', goal: 'Hipertrofia', status: 'Ativo' },
];

// GET: Listar todos os alunos
router.get('/', (req, res) => {
  return res.status(200).json(studentsList);
});

// POST: Criar um novo aluno
router.post('/', (req, res) => {
  const { name, email, goal } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'O nome do aluno é obrigatório.' });
  }

  const newStudent = {
    id: Date.now().toString(),
    name,
    email: email || '',
    goal: goal || 'Condicionamento Físico',
    status: 'Ativo',
  };

  studentsList.push(newStudent);
  return res.status(201).json(newStudent);
});

export default router;
