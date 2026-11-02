# Frontend

Frontend Next.js App Router em `web/`, separado do servidor Express e da configuração TypeScript do backend.

## Configuração local

1. Copie `.env.local.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com a URL e a chave pública (anon/publishable) do projeto Supabase. Nunca use a chave `service_role` no browser.
3. Configure `API_BASE_URL` com a raiz `/api` do backend, por exemplo `http://localhost:3000/api`. Esta variável é usada exclusivamente pelo proxy servidor do Next.js.
4. Instale e execute:

   ```sh
   npm install
   npm run dev
   ```

Abra `http://localhost:3001` se a porta 3000 estiver ocupada pelo backend.

## Autenticação e billing

O login e o signup usam Supabase Auth. O cliente HTTP obtém o access token da sessão e envia `Authorization: Bearer ...` ao proxy same-origin; o proxy encaminha o pedido ao backend sem expor a URL da API ao browser nem depender de CORS. Respostas HTTP `402` da API são apresentadas como subscrição sem acesso.

Depois do signup, o frontend chama `POST /api/onboarding/provision` com a sessão Supabase. Se a confirmação de email estiver ativada e o Supabase ainda não emitir uma sessão, o mesmo provisionamento é tentado após o primeiro login. O backend valida o JWT, compara o email enviado com a claim assinada e cria o personal, tenant e avaliação inicial numa transação. Consulte [../docs/onboarding.md](../docs/onboarding.md) para as variáveis de configuração do plano de avaliação.
