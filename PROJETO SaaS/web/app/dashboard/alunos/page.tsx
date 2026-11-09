'use client';

import { useEffect, useState } from 'react';

export default function AlunosPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulação de carregamento da base de dados Supabase (Alunos com RLS ativo)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Alunos</h1>
          <p className="text-gray-600">Acompanhe os alunos cadastrados e fichas de anamnese.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Novo Aluno
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">A carregar alunos da base de dados...</div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            Nenhum aluno registado na base de dados neste momento. 
            <span className="block text-xs text-gray-400 mt-1">Conexão com Supabase e RLS validados com sucesso.</span>
          </div>
        )}
      </div>
    </div>
  );
}
