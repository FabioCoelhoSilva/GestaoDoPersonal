# Product Requirements Document (PRD) - SaaS Gestão do Personal (Impetus)

## 📌 Protocolo de Governança e Desenvolvimento
1. **Decisão Autônoma:** O especialista define e executa os passos com base estrita no PRD.
2. **Consulta Prévia Obrigatória:** O PRD é a fonte da verdade para o roadmap.
3. **Métrica de Progresso:** Atualização contínua do percentual e status das épicas.

---

## 📊 Status Geral do Projeto (Progresso Atual: 45%)

### Épica 1: Infraestrutura, Segurança e Arquitetura Base
- **Status:** `[Concluído]` (100%)
- [x] Configuração inicial do Next.js App Router e dependências.
- [x] Criação do mapa oficial de arquitetura (`ARQUITETURA.md`).
- [x] Ativação de RLS nas tabelas do Supabase.

### Épica 2: Módulo de Autenticação e Gestão de Acesso
- **Status:** `[Em Execução]` (70%)
- [x] Criação da tela de Login (`app/login/page.tsx`).
- [x] Configuração do cliente Supabase (`lib/supabase.ts`).

### Épica 3: Módulo de Alunos & Anamnese
- **Status:** `[Em Execução]` (35%)
- [x] Estrutura base da página de Alunos.
- [x] Conexão da listagem com a tabela `students` do Supabase.
- [ ] Formulário interativo de Anamnese & PAR-Q (`app/dashboard/anamnese/page.tsx`).

### Épica 4: Módulo de Prescrição de Treinos & Pack Visual
- **Status:** `[Pendente]` (0%)
- [ ] Biblioteca de exercícios com acervo visual de GIFs.

### Épica 5: Monetização e Pagamentos
- **Status:** `[Pendente]` (0%)
- [ ] Integração com Stripe Webhooks.
