import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const treinos = await prisma.treino.findMany({
      include: { aluno: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, treinos });
  } catch (error) {
    console.error('Erro ao buscar treinos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar os treinos.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alunoId, nomeTreino, objetivo, exercicios } = body;

    if (!alunoId || !nomeTreino) {
      return NextResponse.json(
        { success: false, error: 'O aluno e o nome do treino são obrigatórios.' },
        { status: 400 }
      );
    }

    const novoTreino = await prisma.treino.create({
      data: {
        alunoId,
        nomeTreino,
        objetivo,
        exercicios: exercicios || [],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Treino prescrito com sucesso!',
      treino: novoTreino,
    });
  } catch (error) {
    console.error('Erro ao guardar treino:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao salvar o treino.' },
      { status: 500 }
    );
  }
}
