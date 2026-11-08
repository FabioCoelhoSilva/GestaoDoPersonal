import { Router, Request, Response } from 'express';
import { supabase } from '../../service/supabase'; // Ajuste o caminho relativo caso necessário para chegar à pasta service

const router = Router();

// GET: Listar todos os treinos cadastrados
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('workouts').select('*');
    if (error) throw error;
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao listar treinos' });
  }
});

// GET: Obter treinos de um aluno específico por ID do aluno
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('student_id', studentId);

    if (error) throw error;
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao buscar treinos do aluno' });
  }
});

// POST: Criar/Prescrever um novo treino para um aluno
router.post('/', async (req: Request, res: Response) => {
  try {
    const { student_id, title, description, exercises } = req.body;

    if (!student_id || !title) {
      return res.status(400).json({ error: 'O ID do aluno e o título do treino são obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert([{ student_id, title, description, exercises }])
      .select();

    if (error) throw error;

    return res.status(201).json({
      status: 'success',
      message: 'Treino prescrito com sucesso!',
      data: data ? data[0] : null
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao criar treino' });
  }
});

// DELETE: Remover um treino
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) throw error;

    return res.json({
      status: 'success',
      message: 'Treino removido com sucesso!'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao remover treino' });
  }
});

export default router;