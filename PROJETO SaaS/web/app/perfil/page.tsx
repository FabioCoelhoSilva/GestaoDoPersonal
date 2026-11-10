'use client';

import { useState } from 'react';

export default function PerfilPage() {
  const [name, setName] = useState('Fábio Coelho');
  const [email, setEmail] = useState('fb.coelho@hotmail.com');
  const [businessName, setBusinessName] = useState('Consultoria Fitness');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Definições e perfil atualizados com sucesso!');
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#09090b', color: '#f4f4f5', overflow: 'hidden', margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Sidebar Lateral Moderna */}
      <aside style={{ width: '280px', minWidth: '280px', background: '#121216', borderRight: '1px solid #27272a', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', boxSizing: 'border-box' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
            <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', letterSpacing: '-0.5px', margin: 0 }}>impetus<span style={{ color: '#10b981' }}>.</span></h2>
          </div>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', color: '#71717a', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '16px' }}>Plataforma SaaS</p>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <a href="/treinos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
              ⚡ Prescrição de Treinos
            </a>
            <a href="/alunos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
              👥 Gestão de Alunos
            </a>
            <a href="/pagamentos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
              💳 Assinaturas & Financeiro
            </a>
            <a href="/perfil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              ⚙️ Definições e Perfil
            </a>
          </nav>
        </div>

        <div style={{ paddingTop: '24px', borderTop: '1px solid #27272a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', background: '#27272a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#10b981' }}>FC</div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: 0 }}>Fábio Coelho</p>
              <p style={{ fontSize: '11px', color: '#71717a', margin: 0 }}>fb.coelho@hotmail.com</p>
            </div>
          </div>
          <a href="/login" style={{ display: 'block', textAlign: 'center', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Terminar Sessão</a>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '48px 64px', boxSizing: 'border-box', background: '#09090b' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          
          <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px', margin: '0 0 8px 0' }}>Definições e Perfil</h1>
              <p style={{ color: '#a1a1aa', fontSize: '15px', margin: 0 }}>Gerencie as configurações da sua conta e os parâmetros da plataforma.</p>
            </div>
            <div style={{ background: '#121216', border: '1px solid #27272a', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', color: '#10b981', fontWeight: '600' }}>
              ● Sistema Operacional Ativo
            </div>
          </header>

          <form onSubmit={handleSave} style={{ background: '#121216', padding: '40px', borderRadius: '20px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>Informações Profissionais</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase' }}>Nome do Personal</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase' }}>Email de Contacto</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase' }}>Nome da Consultoria / Negócio</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)', marginTop: '10px' }}
            >
              Guardar Alterações
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
