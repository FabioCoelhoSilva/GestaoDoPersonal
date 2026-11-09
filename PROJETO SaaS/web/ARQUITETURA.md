# Arquitetura do Projeto - Gestão do Personal (Web)

Este documento define a estrutura oficial de pastas e rotas do projeto Next.js (App Router).

## 📂 Estrutura Oficial de Pastas (`web/app/`)

- web/
  - app/
    - login/
      - page.tsx (Página de autenticação / login)
    - dashboard/
      - page.tsx (Painel principal do personal)
      - anamnese/
        - page.tsx (Formulário de Anamnese & PAR-Q do aluno)
      - alunos/
        - page.tsx (Gestão e listagem de alunos)
      - treinos/
        - page.tsx (Prescrição e biblioteca de treinos)
    - api/
      - anamnese/
        - route.ts (Endpoints de backend para anamnese)
      - alunos/
        - route.ts (Endpoints de backend para alunos)

---

## 🛠️ Regras de Desenvolvimento
1. **App Router:** Todas as rotas visuais devem residir estritamente dentro de `app/dashboard/`.
2. **Validação Prévia:** Antes de criar ficheiros de código, consulte este mapa.
