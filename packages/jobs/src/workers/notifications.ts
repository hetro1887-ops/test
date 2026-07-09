import { Job } from 'bullmq';
import { prisma } from '@finance/db';

/**
 * Job worker to generate and send daily/weekly digests, anomaly alerts,
 * and push/email notification simulations.
 */
export async function handleNotificationJob(job: Job<{ userId: string; type: 'DAILY_DIGEST' | 'WEEKLY_DIGEST' | 'ANOMALY_ALERT'; transactionId?: string }>) {
  const { userId, type, transactionId } = job.data;
  console.log(`[Notification Worker] Processing ${type} for User: ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  let subject = '';
  let content = '';

  try {
    if (type === 'ANOMALY_ALERT' && transactionId) {
      const anomaly = await prisma.anomaly.findUnique({
        where: { transactionId },
        include: { transaction: true },
      });

      if (anomaly && anomaly.status === 'UNRESOLVED') {
        subject = `⚠️ Suspicious Activity Alert - FinanceFlow`;
        content = `Hi ${user.name},

We detected suspicious activity on your account:
- Transaction: ${anomaly.transaction.name}
- Amount: $${Number(anomaly.transaction.amount).toFixed(2)}
- Reason: ${anomaly.reasons.join(', ')}
- Severity: ${anomaly.severity}

Please review this transaction in your dashboard under "Security & Alerts" to resolve it.`;
      }
    } else if (type === 'DAILY_DIGEST') {
      // Fetch transactions in the last 24h
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const txns = await prisma.transaction.findMany({
        where: {
          account: { userId },
          date: { gte: startOfDay },
        },
        select: { name: true, amount: true },
      });

      const totalSpent = txns
        .filter(t => Number(t.amount) > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      subject = `Daily Financial Digest - FinanceFlow`;
      content = `Hi ${user.name},

Here is your daily financial summary:
- Transactions recorded today: ${txns.length}
- Total spent today: $${totalSpent.toFixed(2)}

${txns.map(t => `- ${t.name}: $${Number(t.amount).toFixed(2)}`).join('\n')}

Have a great evening!`;
    } else if (type === 'WEEKLY_DIGEST') {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const txns = await prisma.transaction.findMany({
        where: {
          account: { userId },
          date: { gte: startOfWeek },
        },
        select: { amount: true },
      });

      const totalSpent = txns
        .filter(t => Number(t.amount) > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const savingsGoals = await prisma.savingGoal.findMany({
        where: { userId },
        select: { name: true, currentAmount: true, targetAmount: true },
      });

      subject = `Weekly Performance Summary - FinanceFlow`;
      content = `Hi ${user.name},

Here is how you performed this week:
- Weekly Outflow: $${totalSpent.toFixed(2)}
- Active savings progress:
${savingsGoals.map(g => `  * ${g.name}: $${Number(g.currentAmount).toFixed(2)} saved of $${Number(g.targetAmount).toFixed(2)} target`).join('\n')}

Keep up the great work saving!`;
    }

    if (subject && content) {
      // Simulate sending via NodeMailer / SES / SendGrid
      console.log(`[Notification Worker] Simulated email sent to ${user.email}:`);
      console.log(`[Subject]: ${subject}`);
      console.log(`[Content]:\n${content}`);
    }

    return { sent: true, type, recipient: user.email };
  } catch (error) {
    console.error(`[Notification Worker] Failed to send notification to user ${userId}:`, error);
    throw error;
  }
}
