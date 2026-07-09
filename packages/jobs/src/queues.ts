import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Using a single shared Redis connection
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 24 * 3600 }, // Keep completed jobs for 24h
    removeOnFail: { age: 7 * 24 * 3600 },  // Keep failed jobs for 7 days
  },
};

export const syncQueue = new Queue('transaction-sync', defaultQueueOptions);
export const categorizeQueue = new Queue('transaction-categorize', defaultQueueOptions);
export const enrichQueue = new Queue('merchant-enrich', defaultQueueOptions);
