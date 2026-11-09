'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Student {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export default function AlunosPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erro ao buscar alunos:', error.message);
        } else {
          setStudents(data || []);
        }
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Alunos</h1>
          <p className="text-gray-600">Visualize e gerencie os alunos vinculados ao seu painel.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Novo Aluno
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">A carregar alunos da base de dados...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 font-medium">Nenhum aluno registado na base de dados.</p>
            <p className="text-xs text-gray-400 mt-1">As tabelas do Supabase com RLS ativo estão operacionais.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {students.map((student) => (
              <div key={student.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{student.name}</p>
                  <p className="text-sm text-gray-500">{student.email}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(student.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
