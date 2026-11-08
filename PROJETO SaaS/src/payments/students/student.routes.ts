import { Router, Request, Response } from 'express';
import { supabase } from '../../service/supabase'; // Ajuste os pontos de subida de diretório se necessário (ex: '../../service/supabase')

const router = Router();

// GET: Listar todos os alunos
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.from('students').select('*');
    if (error) throw error;
    return res.json({ status: 'success', data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao listar alunos' });
  }
});

// POST: Cadastrar um novo aluno
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, goal } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('students')
      .insert([{ name, email, phone, goal }])
      .select();

    if (error) throw error;

    return res.status(201).json({
      status: 'success',
      message: 'Aluno cadastrado com sucesso!',
      data: data ? data[0] : null
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao cadastrar aluno' });
  }
});

// PUT: Atualizar dados de um aluno
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return res.json({
      status: 'success',
      message: `Aluno atualizado com sucesso!`,
      data: data ? data[0] : null
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao atualizar aluno' });
  }
});

// DELETE: Remover um aluno
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw error;

    return res.json({
      status: 'success',
      message: `Aluno removido com sucesso!`
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao remover aluno' });
  }
});

export default router;