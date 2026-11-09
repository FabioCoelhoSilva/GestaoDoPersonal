'use client';

import React, { useState } from 'react';

export default function AnamnesePage() {
  const [alunoId, setAlunoId] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [lesoes, setLesoes] = useState('');
  const [cardiaco, setCardiaco] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('A guardar...');

    try {
      const res = await fetch('/api/anamnese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alunoId, objetivo, lesoes, cardiaco, observacoes }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('Anamnese guardada com sucesso!');
      } else {
        setStatus('Erro: ' + data.error);
      }
    } catch (err) {
      setStatus('Erro de conexão ao salvar.');
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#10B981' }}>Ficha de Anamnese & PAR-Q</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>ID do Aluno:</label>
          <input 
            type="text" 
            value={alunoId} 
            onChange={(e) => setAlunoId(e.target.value)} 
            required
            style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', color: '#fff', borderRadius: '6px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Objetivo Principal:</label>
          <input 
            type="text" 
            value={objetivo} 
            onChange={(e) => setObjetivo(e.target.value)} 
            required
            style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', color: '#fff', borderRadius: '6px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Histórico de Lesões ou Dores:</label>
          <textarea 
            value={lesoes} 
            onChange={(e) => setLesoes(e.target.value)} 
            style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', color: '#fff', borderRadius: '6px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            checked={cardiaco} 
            onChange={(e) => setCardiaco(e.target.checked)} 
            id="cardiaco"
            style={{ width: '18px', height: '18px' }}
          />
          <label htmlFor="cardiaco">Possui histórico ou restrição cardíaca (PAR-Q)?</label>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Observações Gerais:</label>
          <textarea 
            value={observacoes} 
            onChange={(e) => setObservacoes(e.target.value)} 
            style={{ width: '100%', padding: '10px', background: '#1F2937', border: '1px solid #374151', color: '#fff', borderRadius: '6px' }}
          />
        </div>
        <button 
          type="submit"
          style={{ padding: '12px', background: '#10B981', color: '#fff', border: 'none', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}
        >
          Gravar Anamnese
        </button>
        {status && <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{status}</p>}
      </form>
    </div>
  );
}