# Provisionamento inicial de Personal

O endpoint `POST /api/onboarding/provision` exige um JWT Supabase válido. O `providerSub` e o email são obtidos das claims verificadas do token; o corpo aceita somente `{ "email": "..." }`, que deve coincidir com a claim. A rota de provisionamento usa middleware isolado que aceita identidades ainda não existentes na base local, sem relaxar a autenticação das restantes rotas.

O backend cria atomicamente o utilizador `PERSONAL`, o registo `Personal` (tenant) e uma subscrição `TRIALING`. Chamadas repetidas para uma identidade já provisionada são idempotentes. Uma identidade ou email já associado a outra conta é rejeitado.

Configure no ambiente do backend:

- `ONBOARDING_TRIAL_PLAN_ID`: ID de um plano existente e ativo na tabela `plans`.
- `ONBOARDING_TRIAL_DAYS`: duração em dias, de 1 a 90; padrão `14`.

Sem um plano ativo configurado, o endpoint falha com `503` sem criar registos. O acesso de avaliação é bloqueado depois de `currentPeriodEnd`; renovar ou converter a subscrição deve ser feito pelo fluxo de billing.

O frontend provisiona imediatamente quando o signup já devolve uma sessão. Se a confirmação de email estiver ativada e não houver sessão, o utilizador confirma o email e, no login seguinte, a aplicação tenta o provisionamento antes de abrir o dashboard.
