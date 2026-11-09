import { Router } from 'express';

const router = Router();

// Base de dados mockada com o acervo do pack de exercícios do personal
const exercisesLibrary = [
  { id: 'ex1', name: 'Supino Reto com Anilha / Barra', category: 'Peitoral', mediaUrl: '/exercises/supino-reto.gif' },
  { id: 'ex2', name: 'Agachamento Livre', category: 'Membros Inferiores', mediaUrl: '/exercises/agachamento-livre.gif' },
  { id: 'ex3', name: 'Desenvolvimento Militar', category: 'Ombros', mediaUrl: '/exercises/desenvolvimento.gif' },
  { id: 'ex4', name: 'Puxada Alta na Polia', category: 'Dorsais', mediaUrl: '/exercises/puxada-alta.gif' }
];

// GET: Listar exercícios da biblioteca com suporte ao pack gráfico
router.get('/', (req, res) => {
  res.json(exercisesLibrary);
});

export default router;
