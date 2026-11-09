# Product Requirements Document (PRD) - SaaS Gestão do Personal (Impetus)

## 📌 Protocolo de Governança e Desenvolvimento
1. **Decisão Autônoma:** O especialista define e executa os passos com base estrita no PRD.
2. **Resumo Prático & Testes:** Cada entrega inclui um resumo simples e o relatório de testes.
3. **Métrica de Progresso:** Atualização contínua do percentual e status das épicas.

---

## 📊 Status Geral do Projeto (Progresso Atual: 65%)

### Épica 1: Infraestrutura, Segurança e Arquitetura Base
- **Status:** `[Concluído]` (100%)
- [x] Configuração inicial do Next.js App Router e dependências.
- [x] Criação do mapa oficial de arquitetura (`ARQUITETURA.md`).
- [x] Ativação de RLS nas tabelas do Supabase.

### Épica 2: Módulo de Autenticação e Gestão de Acesso
- **Status:** `[Em Execução]` (90%)
- [x] Criação da tela de Login e cliente Supabase.

### Épica 3: Módulo de Alunos & Anamnese
- **Status:** `[Concluído]` (100%)
- [x] Listagem de alunos integrada e formulário de anamnese.

### Épica 4: Módulo de Prescrição de Treinos & Pack Visual
- **Status:** `[Em Execução]` (50%)
- [x] Criação da interface da biblioteca de treinos e suporte ao acervo visual (`app/dashboard/treinos/page.tsx`).

### Épica 5: Monetização e Pagamentos
- **Status:** `[Pendente]` (0%)
- [ ] Integração com Stripe Webhooks.
