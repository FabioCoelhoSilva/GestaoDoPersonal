'use client';
import React from 'react';

export default function ImpetusLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0b0f0a', color: '#f4f4f5', overflow: 'hidden', margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      <aside style={{ width: '280px', minWidth: '280px', background: '#0e1410', borderRight: '1px solid #1c261e', padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', boxSizing: 'border-box' }}>
        <div>
          <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: '#a3e635', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#0b0f0a', fontSize: '15px' }}>i</div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>impetus<span style={{ color: '#a3e635' }}>.</span></h2>
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Painel
            </a>
            <a href="/treinos" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'rgba(163, 230, 53, 0.1)', color: '#a3e635', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', border: '1px solid rgba(163, 230, 53, 0.2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 10h11M6.5 14h11M2 8h3v8H2zM19 8h3v8h-3z"/></svg>
              Meus treinos
            </a>
            <a href="/evolucao" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>
              Evolução
            </a>
            <a href="/alunos" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Meus dados
            </a>
            <a href="/agendamentos" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Agendamentos
            </a>
            <a href="/comunidade" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87"/><path d="M9 3.13a4 4 0 0 1 0 7.75"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Comunidade
            </a>
            <a href="/perfil" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Configurações
            </a>
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
              <h1 style={{ fontSize: '34px', fontWeight: '800', color: '#fff', margin: '8px 0 8px 0', letterSpacing: '-0.5px' }}>{title}</h1>
              <p style={{ color: '#a1a1aa', fontSize: '15px', margin: 0 }}>{subtitle}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0e1410', padding: '8px 16px', borderRadius: '20px', border: '1px solid #1c261e' }}>
              <span style={{ width: '8px', height: '8px', background: '#a3e635', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #a3e635' }}></span>
              <span style={{ fontSize: '12px', color: '#a3e635', fontWeight: '600' }}>Sistema Sincronizado</span>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
