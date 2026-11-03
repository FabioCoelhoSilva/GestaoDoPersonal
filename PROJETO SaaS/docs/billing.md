# Pagamentos e faturação

## Faturação da subscrição Impetus

O perfil do personal está em `/perfil`. A partir daí, uma conta sem subscrição Stripe pode iniciar checkout num plano ativo; uma conta ligada pode abrir o portal Stripe para alterar os dados de faturação, gerir o método de pagamento ou cancelar. As faturas mais recentes são lidas diretamente da API Stripe e os links hospedados/PDF só são devolvidos ao personal autenticado do tenant.

Configure no backend:

- `STRIPE_SECRET_KEY`: chave secreta Stripe (`sk_test_...` para testes ou `sk_live_...` em produção).
- `STRIPE_WEBHOOK_SECRET`: segredo `whsec_...` do endpoint webhook.
- `WEB_APP_URL`: origem HTTPS do frontend, sem path, query ou fragmento. Em desenvolvimento local, `http://localhost:3001` é permitido.

No Stripe Dashboard, configure o portal de faturação e um endpoint `POST /webhooks/stripe` com os eventos:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

O webhook valida a assinatura HMAC sobre o corpo bruto, limita a tolerância temporal, ignora eventos duplicados e rejeita eventos inconsistentes. Os estados são persistidos pelo backend; o perfil apresenta `ACTIVE` como **Ativo**, estados de regularização como **Pendente** e `CANCELED`/`INCOMPLETE_EXPIRED` como **Cancelado**.

Os planos apresentados no checkout vêm do catálogo `plans` e precisam estar ativos e associados a Price IDs recorrentes válidos do Stripe. Não use valores de exemplo em produção.

## Pagamentos de alunos

`/pagamentos` é o espaço financeiro do personal: registo manual de contratos, mensalidades e respetivas confirmações. Estes registos não são cobranças Stripe e são independentes da subscrição que o personal paga ao Impetus.
