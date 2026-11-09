# Product Requirements Document (PRD) - SaaS Gestão do Personal (Impetus)

## 1. Visão Geral do Produto
O **Impetus** é uma plataforma SaaS B2B desenvolvida para Personal Trainers escalarem seus negócios, gerenciarem alunos, prescreverem treinos com acervo visual integrado e automatizarem fichas de anamnese.

## 2. Stack Tecnológica Oficial
- **Frontend / Framework:** Next.js 15+ (App Router), React, Tailwind CSS
- **Backend / Base de Dados:** Supabase (PostgreSQL com Row Level Security - RLS ativo)
- **Versionamento:** Git & GitHub (`main` branch protegida)
- **Servidor de Desenvolvimento Local:** Porta 3001 (com limpeza de cache `.next` prévia)

---

## 3. Épicas e Backlog de Desenvolvimento (Roadmap)

### Épica 1: Infraestrutura, Segurança e Arquitetura Base (Concluído)
- [x] Configuração inicial do Next.js App Router e dependências.
- [x] Criação do mapa oficial de arquitetura (`ARQUITETURA.md`).
- [x] Ativação de RLS (Row Level Security) nas tabelas principais do Supabase (`students`, `personals`, `users`, etc.).

### Épica 2: Módulo de Autenticação e Gestão de Acesso (Em Andamento)
- [ ] Tela de Login e Registo de Personal Trainers (`app/login/page.tsx`).
- [ ] Integração com Supabase Auth para sessões seguras.

### Épica 3: Módulo de Alunos & Anamnese (Próximo Passo)
- [ ] Listagem dinâmica de alunos conectada à tabela `students` do Supabase.
- [ ] Formulário interativo de Anamnese & PAR-Q (`app/dashboard/anamnese/page.tsx`).
- [ ] Cadastro, edição e remoção de perfis de alunos.

### Épica 4: Módulo de Prescrição de Treinos & Pack Visual
- [ ] Interface de biblioteca de exercícios com suporte aos GIFs e acervo visual.
- [ ] Criação e atribuição de fichas de treino por aluno.

### Épica 5: Monetização e Pagamentos (Futuro)
- [ ] Integração com Stripe Webhooks para gestão de assinaturas dos personals.
