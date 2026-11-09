'use client';

import { useState } from 'react';

export default function TreinosPage() {
  const [exercicios] = useState([
    { id: 1, nome: 'Supino Reto com Anilha', categoria: 'Peitoral', pack: 'Ativo' },
    { id: 2, nome: 'Agachamento Livre', categoria: 'Membros Inferiores', pack: 'Ativo' },
    { id: 3, nome: 'Desenvolvimento Militar', categoria: 'Ombros', pack: 'Ativo' },
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescrição de Treinos & Pack Visual</h1>
          <p className="text-gray-600">Monte fichas de treino combinando os exercícios do acervo visual.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Criar Novo Treino
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Biblioteca de Exercícios Disponíveis</h2>
        <div className="divide-y divide-gray-200">
          {exercicios.map((ex) => (
            <div key={ex.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">{ex.nome}</p>
                <p className="text-xs text-gray-500">Categoria: {ex.categoria}</p>
              </div>
              <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                Pack Visual {ex.pack}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
