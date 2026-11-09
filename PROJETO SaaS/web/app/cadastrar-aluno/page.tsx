'use client';

import React, { useState } from 'react';

export default function CadastrarAlunoPage() {
  const [formData, setFormData] = useState({
    nomeAluno: '',
    email: '',
    objetivoPrincipal: '',
    lesoesArticulares: '',
    historicoCardio: '',
    fumaOuBebe: false,
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/alunos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert('Aluno cadastrado com sucesso no Impetus!');
        setFormData({
          nomeAluno: '',
          email: '',
          objetivoPrincipal: '',
          lesoesArticulares: '',
          historicoCardio: '',
          fumaOuBebe: false,
        });
      } else {
        alert('Erro ao cadastrar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error('Erro na requisição:', err);
      alert('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Cadastrar Novo Aluno · Impetus</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nome Completo do Aluno</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.nomeAluno}
            onChange={(e) => setFormData({...formData, nomeAluno: e.target.value})}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail</label>
          <input 
            type="email" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Objetivo Principal</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.objetivoPrincipal}
            onChange={(e) => setFormData({...formData, objetivoPrincipal: e.target.value})}
            placeholder="Ex: Hipertrofia, emagrecimento"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Histórico de Lesões ou Dores Articulares</label>
          <textarea 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.lesoesArticulares}
            onChange={(e) => setFormData({...formData, lesoesArticulares: e.target.value})}
            placeholder="Descreva dores ou restrições"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="fumaBebe"
            className="rounded border-gray-300 text-indigo-600 shadow-sm"
            checked={formData.fumaOuBebe}
            onChange={(e) => setFormData({...formData, fumaOuBebe: e.target.checked})}
          />
          <label htmlFor="fumaBebe" className="text-sm font-medium text-gray-700">Possui hábitos como tabagismo ou consumo frequente de álcool?</label>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'A cadastrar...' : 'Guardar Aluno'}
        </button>
      </form>
    </div>
  );
}