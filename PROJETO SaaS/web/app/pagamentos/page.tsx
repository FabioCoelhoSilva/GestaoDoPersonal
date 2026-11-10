'use client';

import { useState } from 'react';

export default function PagamentosPage() {
  const [payments, setPayments] = useState([
    { id: '1', student: 'Ana Souza', amount: 'R$ 350,00', status: 'Pago', dueDate: '10/11/2026', plan: 'Consultoria Mensal' }
  ]);
  const [studentName, setStudentName] = useState('');
  const [amount, setAmount] = useState('');

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !amount) return;
    setPayments([...payments, {
      id: String(payments.length + 1),
      student: studentName,
      amount: amount.includes('R$') ? amount : `R$ ${amount}`,
      status: 'Pendente',
      dueDate: '25/11/2026',
      plan: 'Consultoria Mensal'
    }]);
    setStudentName('');
    setAmount('');
    alert('Cobrança gerada com sucesso!');
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
            <a href="/pagamentos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              💳 Assinaturas & Financeiro
            </a>
            <a href="/perfil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#a1a1aa', borderRadius: '10px', textDecoration: 'none', fontWeight: '500', fontSize: '14px' }}>
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
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#fff', letterSpacing: '-1px', margin: '0 0 8px 0' }}>Assinaturas & Financeiro</h1>
              <p style={{ color: '#a1a1aa', fontSize: '15px', margin: 0 }}>Controlo de receitas, mensalidades e estado de pagamentos da consultoria.</p>
            </div>
            <div style={{ background: '#121216', border: '1px solid #27272a', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', color: '#10b981', fontWeight: '600' }}>
              ● Receita Mensal: R$ 350,00
            </div>
          </header>

          {/* Formulário para Registar Cobrança */}
          <form onSubmit={handleAddPayment} style={{ background: '#121216', padding: '30px', borderRadius: '20px', border: '1px solid #27272a', marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#fff', margin: 0 }}>Gerar Nova Cobrança</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase' }}>Nome do Aluno</label>
                <input
                  type="text"
                  placeholder="Ex: Ana Souza"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '600', color: '#d4d4d8', textTransform: 'uppercase' }}>Valor (R$)</label>
                <input
                  type="text"
                  placeholder="350,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <button
              type="submit"
              style={{ padding: '12px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', alignSelf: 'flex-end', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
            >
              Registar Cobrança
            </button>
          </form>

          {/* Listagem de Transações */}
          <div style={{ background: '#121216', borderRadius: '20px', border: '1px solid #27272a', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a', fontSize: '14px', fontWeight: '700', color: '#fff' }}>
              Histórico de Assinaturas e Faturas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {payments.map((item) => (
                <div key={item.id} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #18181b' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '600', color: '#fff', margin: '0 0 4px 0' }}>{item.student} • <span style={{ color: '#10b981' }}>{item.amount}</span></p>
                    <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>{item.plan} • Vencimento: {item.dueDate}</p>
                  </div>
                  <div>
                    <span style={{ padding: '6px 12px', background: item.status === 'Pago' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)', color: item.status === 'Pago' ? '#34d399' : '#facc15', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: `1px solid ${item.status === 'Pago' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)'}` }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
