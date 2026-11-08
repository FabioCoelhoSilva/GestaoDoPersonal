import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

export const stripeWebhookRouter = Router();

// Inicializa o Stripe com a chave secreta do ambiente
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-28.acacia' as any, // ou a versão atual que utiliza
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Webhook Error: Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    // Nota: req.body deve vir como Buffer cru (raw body) configurado no server.ts para esta rota
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Tratar os eventos do Stripe
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`💰 Checkout session completed: ${session.id}`);
      // TODO: Atualizar o status da assinatura do aluno no Supabase
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`✅ Invoice payment succeeded: ${invoice.id}`);
      // TODO: Renovar o acesso do aluno na plataforma
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`❌ Subscription canceled/deleted: ${subscription.id}`);
      // TODO: Bloquear o acesso do aluno por falta de pagamento
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Retornar resposta de sucesso para o Stripe
  return res.status(200).json({ received: true });
}

stripeWebhookRouter.post('/', stripeWebhookHandler);