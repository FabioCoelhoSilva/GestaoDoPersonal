'use client';

import { useState } from 'react';

export default function AtribuirTreinoPage() {
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  const [treinoSelecionado, setTreinoSelecionado] = useState('Treino A - Hipertrofia');
  const [sucesso, setSucesso] = useState(false);

  const handleAtribuir = (e: React.FormEvent) => {
    e.preventDefault();
    setSucesso(true);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Atribuir Ficha de Treino</h1>
      <p className="text-gray-600 mb-6">Vincule uma ficha com acervo visual diretamente ao perfil do aluno.</p>

      {sucesso && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Treino atribuído com sucesso ao aluno!
        </div>
      )}

      <form onSubmit={handleAtribuir} className="bg-white p-6 rounded-lg shadow border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar Aluno</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={alunoSelecionado}
            onChange={(e) => setAlunoSelecionado(e.target.value)}
            required
          >
            <option value="">Escolha um aluno...</option>
            <option value="Joao Silva">João Silva</option>
            <option value="Maria Souza">Maria Souza</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ficha de Treino</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={treinoSelecionado}
            onChange={(e) => setTreinoSelecionado(e.target.value)}
          >
            <option value="Treino A - Hipertrofia">Treino A - Membros Superiores (Hipertrofia)</option>
            <option value="Treino B - Inferiores">Treino B - Membros Inferiores (Foco Quadríceps)</option>
            <option value="Treino C - Fullbody">Treino C - Fullbody / Condicionamento</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Confirmar e Enviar Ficha
        </button>
      </form>
    </div>
  );
}
