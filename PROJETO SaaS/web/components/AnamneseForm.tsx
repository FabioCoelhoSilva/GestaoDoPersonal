import React, { useState } from 'react';

export default function AnamneseForm() {
  const [formData, setFormData] = useState({
    nomeAluno: '',
    objetivoPrincipal: '',
    lesoesArticulares: '',
    historicoCardio: '',
    fumaOuBebe: false,
    observacoesClinicas: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/anamnese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Anamnese guardada e integrada no Impetus com sucesso!');
        // Opcional: limpar formulário após sucesso
        setFormData({
          nomeAluno: '',
          objetivoPrincipal: '',
          lesoesArticulares: '',
          historicoCardio: '',
          fumaOuBebe: false,
          observacoesClinicas: ''
        });
      } else {
        alert('Erro ao guardar os dados: ' + (data.error || 'Erro desconhecido'));
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
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Ficha de Anamnese & PAR-Q</h2>
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
          <label className="block text-sm font-medium text-gray-700">Objetivo Principal</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.objetivoPrincipal}
            onChange={(e) => setFormData({...formData, objetivoPrincipal: e.target.value})}
            placeholder="Ex: Hipertrofia, emagrecimento, condicionamento"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Histórico de Lesões ou Dores Articulares</label>
          <textarea 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={formData.lesoesArticulares}
            onChange={(e) => setFormData({...formData, lesoesArticulares: e.target.value})}
            placeholder="Descreva se sente dores nos joelhos, lombar, ombros, etc."
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
          {loading ? 'A guardar...' : 'Guardar e Processar Anamnese'}
        </button>
      </form>
    </div>
  );
}