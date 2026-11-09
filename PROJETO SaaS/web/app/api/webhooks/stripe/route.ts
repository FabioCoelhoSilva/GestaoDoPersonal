import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    // Simulação do processamento seguro do evento de pagamento do Stripe
    const event = JSON.parse(body);

    const { error } = await supabase
      .from('stripe_webhook_events')
      .insert([{ event_type: event.type || 'subscription.created', payload: event }]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}
