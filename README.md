# GestaoDoPersonal

## Interface web

O painel, os alunos, os treinos e o financeiro agora carregam dados do PostgreSQL no
Supabase por uma API no servidor. A autenticação usa Supabase Auth. A chave secreta
permanece no servidor; somente a chave publicável é enviada ao navegador.

### Preparação

1. Na pasta `PROJETO SaaS`, instale as dependências com `npm install`.
2. Configure o `.env` local com `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `DATABASE_URL`.
   Use a connection string PostgreSQL do Supabase para o `DATABASE_URL`. Não coloque
   `SUPABASE_SECRET_KEY` em variáveis `VITE_*` nem no navegador.
3. Gere o cliente do Prisma com `npm run prisma:generate`.
4. Confira cuidadosamente se `DATABASE_URL` aponta para o projeto correto e faça backup.
   Na pasta `PROJETO SaaS`, aplique as migrations versionadas com
   `npm run prisma:deploy`. Isso cria as tabelas da aplicação e inclui a coluna de vínculo
   com Supabase Auth. O comando não importa dados de exemplo nem apaga tabelas existentes.
   Não use `npm run prisma:migrate` no projeto de produção: esse comando é para desenvolvimento.
5. Depois da migration, crie o registro da aplicação correspondente à conta já criada em
   **Supabase → Authentication → Users**. No **SQL Editor**, substitua UUID, e-mail e nome
   pelos dados dessa conta. Execute uma vez e confira se `RETURNING` mostra um `personal_id`:

   ```sql
   WITH auth_account AS (
     SELECT id::text AS id, email
     FROM auth.users
     WHERE id = '<UUID do usuário em Supabase Auth>'::uuid
       AND lower(email) = lower('<email da conta>')
   ),
   app_user AS (
     INSERT INTO public.users
       (id, email, name, role, provider, "supabaseUserId", "updatedAt")
     SELECT id, email, '<nome do personal>', 'PERSONAL'::"Role",
       'OAUTH'::"AuthProvider", id, NOW()
     FROM auth_account
     RETURNING id, name
   )
   INSERT INTO public.personals (id, "userId", name, "updatedAt")
   SELECT gen_random_uuid()::text, id, name, NOW()
   FROM app_user
   RETURNING id AS personal_id, "userId";
   ```

6. Inicie o backend e a interface com `npm run dev` e abra o endereço informado pelo Vite
   (normalmente `http://127.0.0.1:5173`).

Os dados de alunos, treinos e pagamentos existentes aparecem automaticamente. O cadastro
de aluno também é persistido no PostgreSQL. Objetivos, agenda e progresso de treino não são
exibidos porque ainda não existem campos/tabelas para esses dados no schema atual; nenhuma
informação demonstrativa é usada como substituto.

O servidor valida o token do Supabase Auth e deriva o `personalId` do usuário vinculado;
não confia em um tenant enviado pelo navegador. A variável `DATABASE_URL` e quaisquer
chaves secretas são apenas do servidor. Não compartilhe nem faça commit do `.env`.

Para validar a implementação:

```powershell
npm run typecheck
npm run test:auth
npm run test:supabase-rest
npm run build
```

O modelo de variáveis está em [PROJETO SaaS/.env.example](./PROJETO%20SaaS/.env.example).

`npm run test:isolation` e a suíte completa usam `TEST_DATABASE_URL` e apagam os dados
do banco/schema indicado. Configure um alvo isolado cujo nome termine em `_test`; nunca
aponte essa variável para o banco de produção.
