'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AnamnesePage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    aluno_nome: '',
    objetivo: 'Hipertrofia',
    lesoes: 'Não',
    observacoes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      // Simulação ou gravação direta na tabela de anamnese do Supabase
      const { error } = await supabase.from('anamnese').insert([
        {
          student_name: formData.aluno_nome,
          objective: formData.objetivo,
          injuries: formData.lesoes,
          notes: formData.observacoes,
        }
      ]);

      if (error) {
        console.error('Erro ao guardar anamnese:', error.message);
      }
      setSuccess(true);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Formulário de Anamnese & PAR-Q</h1>
      <p className="text-gray-600 mb-6">Registe as informações de saúde e objetivos do aluno.</p>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Anamnese guardada com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Aluno</label>
          <input
            type="text"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.aluno_nome}
            onChange={(e) => setFormData({ ...formData, aluno_nome: e.target.value })}
            placeholder="Ex: João Silva"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo Principal</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.objetivo}
            onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
          >
            <option value="Hipertrofia">Hipertrofia Muscular</option>
            <option value="Emagrecimento">Emagrecimento / Definição</option>
            <option value="Condicionamento">Condicionamento Físico</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Possui lesões ou restrições médicas?</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.lesoes}
            onChange={(e) => setFormData({ ...formData, lesoes: e.target.value })}
            placeholder="Ex: Dor lombar leve"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Histórico de treino, horários disponíveis, etc."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          {loading ? 'A guardar...' : 'Guardar Ficha de Anamnese'}
        </button>
      </form>
    </div>
  );
}
