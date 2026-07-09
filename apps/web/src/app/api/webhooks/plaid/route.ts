import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const webhookType = body.webhook_type as string;
    const webhookCode = body.webhook_code as string;
    const itemId = body.item_id as string;

    console.log(`[Plaid Webhook] type=${webhookType} code=${webhookCode} item=${itemId}`);

    if (webhookType === 'TRANSACTIONS') {
      if (webhookCode === 'SYNC_UPDATES_AVAILABLE') {
        // In production, queue a sync job via a job queue (e.g., BullMQ)
        console.log(`[Plaid Webhook] Queuing transaction sync for item ${itemId}`);
        // await syncQueue.add('sync-transactions', { itemId });
      }

      if (webhookCode === 'INITIAL_UPDATE' || webhookCode === 'HISTORICAL_UPDATE') {
        console.log(`[Plaid Webhook] ${webhookCode} received for item ${itemId}`);
      }
    }

    if (webhookType === 'ITEM') {
      if (webhookCode === 'LOGIN_REQUIRED' || webhookCode === 'PENDING_EXPIRATION') {
        console.log(`[Plaid Webhook] Item ${itemId} requires re-authentication`);
        // In production, update the item status in the database
        // await db.plaidItem.update({ where: { plaidItemId: itemId }, data: { status: 'LOGIN_REQUIRED' } });
      }

      if (webhookCode === 'ERROR') {
        const error = body.error;
        console.error(`[Plaid Webhook] Item error for ${itemId}:`, error);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Plaid Webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Plaid webhook endpoint active' });
}
