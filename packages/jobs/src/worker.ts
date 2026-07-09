import { Worker } from 'bullmq';
import { connection } from './queues';
import { handleSyncJob } from './workers/sync';
import { handleCategorizeJob } from './workers/categorize';
import { handleEnrichJob } from './workers/enrich';

console.log('[Worker Runner] Starting all BullMQ background workers...');

// 1. Transaction Sync Worker
const syncWorker = new Worker(
  'transaction-sync',
  async (job) => {
    await handleSyncJob(job);
  },
  {
    connection,
    concurrency: 2,
  }
);

// 2. Transaction Categorization Worker
const categorizeWorker = new Worker(
  'transaction-categorize',
  async (job) => {
    await handleCategorizeJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

// 3. Merchant Enrichment Worker
const enrichWorker = new Worker(
  'merchant-enrich',
  async (job) => {
    await handleEnrichJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

// 4. Notifications & Digest Worker
const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    // Import dynamically to avoid circular references/load ordering issues
    const { handleNotificationJob } = await import('./workers/notifications');
    await handleNotificationJob(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

// Logging lifecycle events
syncWorker.on('completed', (job) => console.log(`[Sync Worker] Job ${job.id} completed.`));
syncWorker.on('failed', (job, err) => console.error(`[Sync Worker] Job ${job?.id} failed:`, err));

categorizeWorker.on('completed', (job) => console.log(`[Categorize Worker] Job ${job.id} completed.`));
categorizeWorker.on('failed', (job, err) => console.error(`[Categorize Worker] Job ${job?.id} failed:`, err));

enrichWorker.on('completed', (job) => console.log(`[Enrich Worker] Job ${job.id} completed.`));
enrichWorker.on('failed', (job, err) => console.error(`[Enrich Worker] Job ${job?.id} failed:`, err));

notificationWorker.on('completed', (job) => console.log(`[Notification Worker] Job ${job.id} completed.`));
notificationWorker.on('failed', (job, err) => console.error(`[Notification Worker] Job ${job?.id} failed:`, err));

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('[Worker Runner] Shutting down workers gracefully...');
  await Promise.all([
    syncWorker.close(),
    categorizeWorker.close(),
    enrichWorker.close(),
    notificationWorker.close(),
  ]);
  console.log('[Worker Runner] Shutdown complete.');
  process.exit(0);
});
