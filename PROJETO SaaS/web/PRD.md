# Product Requirements Document (PRD) - SaaS Gestão do Personal (Impetus)

## 📌 Protocolo de Governança e Desenvolvimento
1. **Consulta Prévia Obrigatória:** Antes de criar qualquer ficheiro ou código, o PRD deve ser consultado.
2. **Documentação Viva:** Toda nova informação ou alteração de escopo deve ser imediatamente refletida no PRD.
3. **Métrica de Progresso:** Cada entrega deve apresentar o percentual de conclusão atualizado e o status das épicas.

---

## 📊 Status Geral do Projeto (Progresso Atual: 40%)

### Épica 1: Infraestrutura, Segurança e Arquitetura Base
- **Status:** `[Concluído]` (100%)
- [x] Configuração inicial do Next.js App Router e dependências.
- [x] Criação do mapa oficial de arquitetura (`ARQUITETURA.md`).
- [x] Ativação de RLS (Row Level Security) nas tabelas do Supabase.

### Épica 2: Módulo de Autenticação e Gestão de Acesso
- **Status:** `[Em Execução]` (50%)
- [x] Criação da tela de Login (`app/login/page.tsx`).
- [ ] Integração completa com Supabase Auth.

### Épica 3: Módulo de Alunos & Anamnese
- **Status:** `[Em Execução]` (30%)
- [x] Estrutura base da página de Alunos (`app/dashboard/alunos/page.tsx`).
- [ ] Listagem dinâmica integrada à tabela `students`.
- [ ] Formulário interativo de Anamnese & PAR-Q (`app/dashboard/anamnese/page.tsx`).

### Épica 4: Módulo de Prescrição de Treinos & Pack Visual
- **Status:** `[Pendente]` (0%)
- [ ] Biblioteca de exercícios com suporte ao acervo visual de GIFs.
- [ ] Atribuição de fichas de treino por aluno.

### Épica 5: Monetização e Pagamentos
- **Status:** `[Pendente]` (0%)
- [ ] Integração com Stripe Webhooks.
