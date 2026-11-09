import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Dados recebidos no Impetus:', body);

    return NextResponse.json({ 
      success: true, 
      message: 'Anamnese guardada com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao processar anamnese:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar os dados.' }, 
      { status: 500 }
    );
  }
}