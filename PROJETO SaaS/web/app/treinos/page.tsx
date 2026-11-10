'use client';
import { useState } from 'react';

export default function TreinosPage() {
  const [aluno, setAluno] = useState('Ana Souza');
  const [ciclo, setCiclo] = useState('Treino A (Membros Superiores)');
  const [titulo, setTitulo] = useState('');
  const [diretrizes, setDiretrizes] = useState('');

  const handlePublicar = (e) => {
    e.preventDefault();
    if (!titulo || !diretrizes) {
      alert('Por favor, preencha o título e as diretrizes do treino.');
      return;
    }
    alert('Plano de treino publicado e enviado para o aluno com sucesso!');
    setTitulo('');
    setDiretrizes('');
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0b0f0a', color: '#f4f4f5', overflow: 'hidden', margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <aside style={{ width: '280px', minWidth: '280px', background: '#0e1410', borderRight: '1px solid #1c261e', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', boxSizing: 'border-box' }}>
        <div>
          <div style={{ marginBottom: '36px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: '#a3e635', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#0b0f0a', fontSize: '15px' }}>i</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>impetus<span style={{ color: '#a3e635' }}>.</span></h2>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <a href="/treinos" style={{ padding: '12px 16px', background: 'rgba(163, 230, 53, 0.1)', color: '#a3e635', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', border: '1px solid rgba(163, 230, 53, 0.2)' }}>⚡ Prescrição de Treinos</a>
            <a href="/alunos" style={{ padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>👥 Gestão de Alunos</a>
            <a href="/pagamentos" style={{ padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>💳 Assinaturas & Financeiro</a>
            <a href="/perfil" style={{ padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>⚙️ Definições e Perfil</a>
          </nav>
        </div>
        <div style={{ background: '#121a14', padding: '16px', borderRadius: '12px', border: '1px solid #1c261e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: '#a3e635', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#0b0f0a', fontSize: '13px' }}>FC</div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: 0 }}>Fábio Coelho</p>
              <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>fb.coelho@hotmail.com</p>
            </div>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '48px 64px', boxSizing: 'border-box', background: '#0b0f0a' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '36px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#a3e635', letterSpacing: '1.5px', textTransform: 'uppercase' }}>TREINE. ACOMPANHE. EVOLUA.</span>
              <h1 style={{ fontSize: '34px', fontWeight: '800', color: '#fff', margin: '8px 0 8px 0', letterSpacing: '-0.5px' }}>Prescrição de Treinos</h1>
              <p style={{ color: '#a1a1aa', fontSize: '15px', margin: 0 }}>Estruture treinos altamente personalizados com foco em sobrecarga progressiva.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e1410', padding: '8px 16px', borderRadius: '20px', border: '1px solid #1c261e' }}>
              <span style={{ width: '8px', height: '8px', background: '#a3e635', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #a3e635' }}></span>
              <span style={{ fontSize: '12px', color: '#a3e635', fontWeight: '600' }}>Sistema Sincronizado</span>
            </div>
          </div>
          <form onSubmit={handlePublicar} style={{ background: '#0e1410', padding: '40px', borderRadius: '20px', border: '1px solid #1c261e', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#a1a1aa', letterSpacing: '0.8px', marginBottom: '8px' }}>ALUNO ALVO</label>
                <select value={aluno} onChange={(e) => setAluno(e.target.value)} style={{ width: '100%', padding: '14px 16px', background: '#121a14', border: '1px solid #1c261e', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                  <option value="Ana Souza">Ana Souza</option>
                  <option value="Jacyara Lemos">Jacyara Lemos</option>
                  <option value="Carlos Silva">Carlos Silva</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#a1a1aa', letterSpacing: '0.8px', marginBottom: '8px' }}>CICLO / DIVISÃO</label>
                <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} style={{ width: '100%', padding: '14px 16px', background: '#121a14', border: '1px solid #1c261e', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none' }}>
                  <option value="Treino A (Membros Superiores)">Treino A (Membros Superiores)</option>
                  <option value="Treino B (Membros Inferiores)">Treino B (Membros Inferiores)</option>
                  <option value="Treino C (Full Body / Core)">Treino C (Full Body / Core)</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#a1a1aa', letterSpacing: '0.8px', marginBottom: '8px' }}>TÍTULO DA PRESCRIÇÃO</label>
              <input type="text" placeholder="Ex: Hipertrofia Avançada - Ênfase em Quadríceps" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ width: '100%', padding: '14px 16px', background: '#121a14', border: '1px solid #1c261e', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#a1a1aa', letterSpacing: '0.8px', marginBottom: '8px' }}>METODOLOGIA & DIRETRIZES DE EXECUÇÃO</label>
              <textarea placeholder="Ex: Manter 2 segundos de excêntrica em todos os exercícios compostos. Descanso de 90s a 2min entre séries." rows={5} value={diretrizes} onChange={(e) => setDiretrizes(e.target.value)} style={{ width: '100%', padding: '14px 16px', background: '#121a14', border: '1px solid #1c261e', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '16px', background: '#a3e635', color: '#0b0f0a', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s', marginTop: '8px', boxShadow: '0 4px 20px rgba(163, 230, 53, 0.3)' }}>
              Publicar e Enviar para o Aluno
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
