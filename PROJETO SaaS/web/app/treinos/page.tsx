"use client";

import React, { useEffect, useState } from "react";

interface Aluno {
  id: string;
  nomeAluno: string;
}

export default function TreinosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState("");
  const [nomeTreino, setNomeTreino] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/alunos")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAlunos(data.alunos);
        }
      })
      .catch((err) => console.error("Erro ao carregar alunos:", err));
  }, []);

  const handleSalvarTreino = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alunoSelecionado || !nomeTreino) {
      alert("Selecione um aluno e informe o nome do treino.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/treinos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alunoId: alunoSelecionado,
          nomeTreino,
          objetivo,
          exercicios: [],
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Treino prescrito e vinculado com sucesso!");
        setNomeTreino("");
        setObjetivo("");
      } else {
        alert("Erro ao salvar: " + data.error);
      }
    } catch (err) {
      console.error("Erro na requisição:", err);
      alert("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Prescrição de Treinos · Impetus</h2>
      
      <form onSubmit={handleSalvarTreino} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Selecione o Aluno</label>
          <select 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={alunoSelecionado}
            onChange={(e) => setAlunoSelecionado(e.target.value)}
            required
          >
            <option value="">Escolha um aluno...</option>
            {alunos.map((aluno) => (
              <option key={aluno.id} value={aluno.id}>{aluno.nomeAluno}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nome do Treino</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={nomeTreino}
            onChange={(e) => setNomeTreino(e.target.value)}
            placeholder="Ex: Treino A - Hipertrofia de Membros Superiores"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Objetivo Específico</label>
          <input 
            type="text" 
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Ex: Foco em sobrecarga progressiva"
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? "A salvar treino..." : "Gerar e Salvar Prescrição"}
        </button>
      </form>
    </div>
  );
}
