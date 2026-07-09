export * from './queues';

import { syncQueue, categorizeQueue, enrichQueue } from './queues';

/**
 * Adds a transaction sync job for a specific Plaid Item.
 */
export async function queueSyncTransactions(plaidItemId: string) {
  return syncQueue.add('sync', { plaidItemId }, {
    jobId: `sync:${plaidItemId}:${Date.now()}`, // unique per run
  });
}

/**
 * Adds a categorization job for a single transaction.
 */
export async function queueCategorizeTransaction(transactionId: string) {
  return categorizeQueue.add('categorize', { transactionId });
}

/**
 * Adds a merchant enrichment job for a single transaction.
 */
export async function queueEnrichMerchant(transactionId: string) {
  return enrichQueue.add('enrich', { transactionId });
}
