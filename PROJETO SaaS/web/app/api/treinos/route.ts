import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { aluno_id, treino_nome, exercicios } = body;

    const { data, error } = await supabase
      .from('assigned_workouts')
      .insert([{ student_id: aluno_id, workout_name: treino_nome, items: exercicios }]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
