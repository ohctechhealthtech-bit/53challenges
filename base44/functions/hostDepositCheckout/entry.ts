import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.5.0';
import { secrets } from 'base44:runtime';

const DEPOSITS = {
  supported: { amount: 14900, label: 'Challenge hosting deposit — Supported package' },
  fully_managed: { amount: 29900, label: 'Challenge hosting deposit — Fully managed package' },
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const proposal = body?.proposal_data || {};
    const deposit = DEPOSITS[proposal.delivery_level];
    if (!deposit) return Response.json({ error: 'No deposit required for this package' }, { status: 400 });

    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const intent = await stripe.paymentIntents.create({
      amount: deposit.amount,
      currency: 'aud',
      receipt_email: user.email,
      description: `${deposit.label} — ${proposal.challenge_title || 'Your challenge'}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: user.id,
        delivery_level: String(proposal.delivery_level || ''),
        challenge_title: String(proposal.challenge_title || '').slice(0, 200),
      },
    });

    return Response.json({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      amount: deposit.amount,
      label: deposit.label,
      publishable_key: secrets.get('STRIPE_PUBLISHABLE_KEY'),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}