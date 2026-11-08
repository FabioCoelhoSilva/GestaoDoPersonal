'use client';

import React, { useEffect, useState } from 'react';

interface Metrics {
  activeStudents: number;
  activeWorkouts: number;
  monthlySessions: number;
  growthRate: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    activeStudents: 0,
    activeWorkouts: 0,
    monthlySessions: 0,
    growthRate: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics({
          activeStudents: data.activeStudents ?? 0,
          activeWorkouts: data.activeWorkouts ?? 0,
          monthlySessions: data.monthlySessions ?? 0,
          growthRate: data.growthRate ?? 0,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', color: '#fff', background: '#121212', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Impetus | Painel de Controlo</h1>
          <p style={{ color: '#888', fontSize: '14px', margin: '4px 0 0 0' }}>Consultoria Fitness & Gestão</p>
        </div>
        <button 
          onClick={fetchMetrics}
          style={{ background: '#10B981', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'A atualizar...' : 'Tentar novamente'}
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#1E1E1E', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
          <p style={{ color: '#888', margin: '0 0 8px 0' }}>Alunos Ativos</p>
          <h2 style={{ fontSize: '32px', margin: 0 }}>{metrics.activeStudents}</h2>
        </div>
        <div style={{ background: '#1E1E1E', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
          <p style={{ color: '#888', margin: '0 0 8px 0' }}>Treinos Ativos</p>
          <h2 style={{ fontSize: '32px', margin: 0 }}>{metrics.activeWorkouts}</h2>
        </div>
        <div style={{ background: '#1E1E1E', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
          <p style={{ color: '#888', margin: '0 0 8px 0' }}>Sessões Mensais</p>
          <h2 style={{ fontSize: '32px', margin: 0 }}>{metrics.monthlySessions}</h2>
        </div>
        <div style={{ background: '#1E1E1E', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
          <p style={{ color: '#888', margin: '0 0 8px 0' }}>Taxa de Crescimento</p>
          <h2 style={{ fontSize: '32px', margin: 0 }}>{metrics.growthRate}%</h2>
        </div>
      </div>
    </div>
  );
}