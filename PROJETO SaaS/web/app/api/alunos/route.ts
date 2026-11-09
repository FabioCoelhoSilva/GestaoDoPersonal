import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Listar todos os alunos registados
export async function GET() {
  try {
    const alunos = await prisma.aluno.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, alunos });
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar os alunos.' },
      { status: 500 }
    );
  }
}

// POST: Registar um novo aluno / anamnese
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nomeAluno, email, objetivoPrincipal, lesoesArticulares, historicoCardio, fumaOuBebe } = body;

    if (!nomeAluno) {
      return NextResponse.json(
        { success: false, error: 'O nome do aluno é obrigatório.' },
        { status: 400 }
      );
    }

    const novoAluno = await prisma.aluno.create({
      data: {
        nomeAluno,
        email,
        objetivoPrincipal,
        lesoesArticulares,
        historicoCardio,
        fumaOuBebe: Boolean(fumaOuBebe),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Aluno registado com sucesso no Impetus!',
      aluno: novoAluno,
    });
  } catch (error) {
    console.error('Erro ao guardar aluno:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar os dados do aluno.' },
      { status: 500 }
    );
  }
}