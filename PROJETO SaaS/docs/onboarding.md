# Provisionamento inicial de Personal

O endpoint `POST /api/onboarding/provision` exige um JWT Supabase válido. O `providerSub` e o email são obtidos das claims verificadas do token; o corpo aceita somente `{ "email": "..." }`, que deve coincidir com a claim. A rota de provisionamento usa middleware isolado que aceita identidades ainda não existentes na base local, sem relaxar a autenticação das restantes rotas.

O backend cria atomicamente o utilizador `PERSONAL`, o registo `Personal` (tenant) e uma subscrição `TRIALING`. Chamadas repetidas para uma identidade já provisionada são idempotentes. Uma identidade ou email já associado a outra conta é rejeitado.

Configure no ambiente do backend:

- `SUPABASE_URL`: URL HTTPS do projeto Supabase; usada para validar issuer e chaves JWT.
- `DATABASE_URL` e `DIRECT_URL`: strings de ligação PostgreSQL do Supabase. Consulte `Supabase > Connect`; `DIRECT_URL` deve ser a ligação direta usada pelo Prisma CLI. O ficheiro `.env.example` contém apenas o formato ilustrativo.
- `ONBOARDING_TRIAL_PLAN_ID`: ID de um plano existente e ativo na tabela `plans`.
- `ONBOARDING_TRIAL_DAYS`: duração em dias, de 1 a 90; padrão `14`.
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`: chaves secretas do backend obtidas no painel Stripe. Configure `POST /webhooks/stripe` para receber `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
- `WEB_APP_URL`: origem HTTPS do frontend usada como retorno seguro do checkout e do portal Stripe; em desenvolvimento local pode ser `http://localhost:3001`.

Sem um plano ativo configurado, o endpoint falha com `503` sem criar registos. O acesso de avaliação é bloqueado depois de `currentPeriodEnd`; renovar ou converter a subscrição deve ser feito pelo fluxo de billing.

Copie `.env.example` para `.env` e substitua os valores ilustrativos pelas configurações do seu projeto. Nunca versione `.env` nem partilhe strings PostgreSQL, chaves secretas ou tokens.

O frontend tenta provisionar imediatamente quando o signup já devolve uma sessão. Se a confirmação de email estiver ativada e não houver sessão, o utilizador confirma o email e, no login seguinte, a aplicação tenta o provisionamento. A autenticação não fica bloqueada por falhas nessa chamada: o utilizador entra no dashboard, que indica que o provisionamento está pendente. Enquanto o backend não criar o perfil e o tenant, as operações que exigem esses recursos podem continuar indisponíveis.

No perfil `/perfil`, o personal pode iniciar uma subscrição num plano ativo, gerir uma subscrição existente no portal Stripe e consultar as faturas. Os estados do Stripe são apresentados como **Ativo**, **Pendente** ou **Cancelado** e atualizados pelos webhooks assinados. O ecrã `/pagamentos` continua destinado a contratos e mensalidades cobrados aos alunos, separados da subscrição Impetus do personal.

Antes de ativar checkout, configure planos ativos com Price IDs recorrentes válidos do Stripe e ative o portal de faturação no Stripe Dashboard. Nunca exponha `STRIPE_SECRET_KEY` ou `STRIPE_WEBHOOK_SECRET` no frontend.
