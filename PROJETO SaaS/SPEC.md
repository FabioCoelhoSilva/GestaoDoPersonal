# SPEC.md - Especificação Técnica e Planeamento do Projeto
# Projeto: GestaoDoPersonal

## 1. Visão Geral
Plataforma SaaS desenvolvida em TypeScript para apoiar Personal Trainers na gestão profissional de alunos, prescrição de fichas de treino personalizadas e monitorização de evolução física.

## 2. Estrutura e Arquitetura do Repositório
- **`schema.sql`**: Contém a definição relacional das tabelas da base de dados (utilizadores, treinos, exercícios, histórico).
- **`config.js`**: Ficheiro central de parâmetros e configurações do ambiente.
- **`PROJETO SaaS/`**: Diretório principal contendo o código-fonte da aplicação (serviços, rotas, lógica de negócio e relatórios).

## 3. Fases de Desenvolvimento (Roadmap)

### Fase 1: Fundação e Base de Dados
- [x] Estruturação inicial do repositório e diretórios.
- [ ] Validação do `schema.sql` com as tabelas essenciais (Alunos, Treinos, Exercícios).

### Fase 2: Módulo de Utilizadores e Autenticação
- [ ] Registo e login de Personal Trainers.
- [ ] Gestão de perfis de alunos associados a cada personal.

### Fase 3: Módulo de Treinos (`workout-sheet`)
- [ ] Criação, edição e listagem de fichas de treino.
- [ ] Associação de exercícios, séries, repetições e dias da semana específicos por aluno.

### Fase 4: Relatórios e Acompanhamento
- [ ] Registo de progresso de cargas e histórico de treinos realizados.