import { PrismaClient, AccountType, PaymentChannel, PlaidItemStatus } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a deterministic dedup hash for a transaction. */
function txHash(plaidTransactionId: string, accountId: string): string {
  return createHash('sha256')
    .update(`${plaidTransactionId}:${accountId}`)
    .digest('hex');
}

/** Return a random date within the last `days` days. */
function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

/** Return a random number between min and max (inclusive, 2 decimals). */
function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/** Pick a random element from an array. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Produce a fake "encrypted" access token string.
 * In production the real encrypt() utility is used; for seed data we just
 * create a plausible-looking hex string so the column is populated.
 */
function fakeEncryptedToken(): string {
  const iv = randomBytes(16).toString('hex');
  const tag = randomBytes(16).toString('hex');
  const cipher = randomBytes(32).toString('hex');
  return `${iv}:${tag}:${cipher}`;
}

// ─── Seed Data Definitions ──────────────────────────────────────────────────

const TEST_PASSWORD = hashSync('test1234', 10);

const USERS = [
  { email: 'alice@example.com', name: 'Alice Johnson' },
  { email: 'bob@example.com', name: 'Bob Smith' },
  { email: 'carol@example.com', name: 'Carol Williams' },
  { email: 'david@example.com', name: 'David Brown' },
  { email: 'eve@example.com', name: 'Eve Davis' },
];

const CATEGORIES_DATA = [
  { name: 'food_and_dining', displayName: 'Food & Dining', icon: '🍽️', color: '#FF6384' },
  { name: 'shopping', displayName: 'Shopping', icon: '🛍️', color: '#36A2EB' },
  { name: 'transportation', displayName: 'Transportation', icon: '🚗', color: '#FFCE56' },
  { name: 'entertainment', displayName: 'Entertainment', icon: '🎬', color: '#4BC0C0' },
  { name: 'bills_and_utilities', displayName: 'Bills & Utilities', icon: '💡', color: '#9966FF' },
  { name: 'health', displayName: 'Health', icon: '🏥', color: '#FF9F40' },
  { name: 'travel', displayName: 'Travel', icon: '✈️', color: '#C9CBCF' },
  { name: 'income', displayName: 'Income', icon: '💰', color: '#4CAF50' },
  { name: 'transfer', displayName: 'Transfer', icon: '🔄', color: '#607D8B' },
  { name: 'other', displayName: 'Other', icon: '📦', color: '#795548' },
];

const MERCHANTS_DATA = [
  { name: 'Starbucks', displayName: 'Starbucks', category: 'food_and_dining', website: 'starbucks.com', logoUrl: 'https://logo.clearbit.com/starbucks.com' },
  { name: 'Amazon', displayName: 'Amazon', category: 'shopping', website: 'amazon.com', logoUrl: 'https://logo.clearbit.com/amazon.com' },
  { name: 'Uber', displayName: 'Uber', category: 'transportation', website: 'uber.com', logoUrl: 'https://logo.clearbit.com/uber.com' },
  { name: 'Netflix', displayName: 'Netflix', category: 'entertainment', website: 'netflix.com', logoUrl: 'https://logo.clearbit.com/netflix.com' },
  { name: 'Whole Foods', displayName: 'Whole Foods Market', category: 'food_and_dining', website: 'wholefoodsmarket.com', logoUrl: 'https://logo.clearbit.com/wholefoodsmarket.com' },
  { name: 'Target', displayName: 'Target', category: 'shopping', website: 'target.com', logoUrl: 'https://logo.clearbit.com/target.com' },
  { name: 'Spotify', displayName: 'Spotify', category: 'entertainment', website: 'spotify.com', logoUrl: 'https://logo.clearbit.com/spotify.com' },
  { name: 'Shell', displayName: 'Shell Gas Station', category: 'transportation', website: 'shell.com', logoUrl: 'https://logo.clearbit.com/shell.com' },
  { name: 'CVS Pharmacy', displayName: 'CVS Pharmacy', category: 'health', website: 'cvs.com', logoUrl: 'https://logo.clearbit.com/cvs.com' },
  { name: 'Costco', displayName: 'Costco Wholesale', category: 'shopping', website: 'costco.com', logoUrl: 'https://logo.clearbit.com/costco.com' },
  { name: 'Chipotle', displayName: 'Chipotle Mexican Grill', category: 'food_and_dining', website: 'chipotle.com', logoUrl: 'https://logo.clearbit.com/chipotle.com' },
  { name: 'Delta Airlines', displayName: 'Delta Air Lines', category: 'travel', website: 'delta.com', logoUrl: 'https://logo.clearbit.com/delta.com' },
  { name: 'Comcast', displayName: 'Comcast Xfinity', category: 'bills_and_utilities', website: 'xfinity.com', logoUrl: 'https://logo.clearbit.com/xfinity.com' },
  { name: 'Walgreens', displayName: 'Walgreens', category: 'health', website: 'walgreens.com', logoUrl: 'https://logo.clearbit.com/walgreens.com' },
  { name: 'Home Depot', displayName: 'The Home Depot', category: 'shopping', website: 'homedepot.com', logoUrl: 'https://logo.clearbit.com/homedepot.com' },
];

/** Template transactions with realistic descriptions and amount ranges. */
const TX_TEMPLATES: Array<{
  merchantName: string;
  name: string;
  categoryName: string;
  minAmount: number;
  maxAmount: number;
  channel: PaymentChannel;
  pfcPrimary: string;
}> = [
  { merchantName: 'Starbucks', name: 'Starbucks Coffee', categoryName: 'food_and_dining', minAmount: 3.5, maxAmount: 8.75, channel: 'IN_STORE', pfcPrimary: 'FOOD_AND_DRINK' },
  { merchantName: 'Amazon', name: 'Amazon.com Purchase', categoryName: 'shopping', minAmount: 9.99, maxAmount: 249.99, channel: 'ONLINE', pfcPrimary: 'GENERAL_MERCHANDISE' },
  { merchantName: 'Uber', name: 'Uber Trip', categoryName: 'transportation', minAmount: 8, maxAmount: 45, channel: 'ONLINE', pfcPrimary: 'TRANSPORTATION' },
  { merchantName: 'Netflix', name: 'Netflix Subscription', categoryName: 'entertainment', minAmount: 15.49, maxAmount: 22.99, channel: 'ONLINE', pfcPrimary: 'ENTERTAINMENT' },
  { merchantName: 'Whole Foods', name: 'Whole Foods Market', categoryName: 'food_and_dining', minAmount: 22, maxAmount: 185, channel: 'IN_STORE', pfcPrimary: 'FOOD_AND_DRINK' },
  { merchantName: 'Target', name: 'Target Purchase', categoryName: 'shopping', minAmount: 12, maxAmount: 150, channel: 'IN_STORE', pfcPrimary: 'GENERAL_MERCHANDISE' },
  { merchantName: 'Spotify', name: 'Spotify Premium', categoryName: 'entertainment', minAmount: 10.99, maxAmount: 16.99, channel: 'ONLINE', pfcPrimary: 'ENTERTAINMENT' },
  { merchantName: 'Shell', name: 'Shell Gas', categoryName: 'transportation', minAmount: 25, maxAmount: 75, channel: 'IN_STORE', pfcPrimary: 'TRANSPORTATION' },
  { merchantName: 'CVS Pharmacy', name: 'CVS Pharmacy', categoryName: 'health', minAmount: 5, maxAmount: 85, channel: 'IN_STORE', pfcPrimary: 'MEDICAL' },
  { merchantName: 'Costco', name: 'Costco Wholesale', categoryName: 'shopping', minAmount: 50, maxAmount: 350, channel: 'IN_STORE', pfcPrimary: 'GENERAL_MERCHANDISE' },
  { merchantName: 'Chipotle', name: 'Chipotle Mexican Grill', categoryName: 'food_and_dining', minAmount: 8.5, maxAmount: 18, channel: 'IN_STORE', pfcPrimary: 'FOOD_AND_DRINK' },
  { merchantName: 'Delta Airlines', name: 'Delta Airlines Ticket', categoryName: 'travel', minAmount: 150, maxAmount: 850, channel: 'ONLINE', pfcPrimary: 'TRAVEL' },
  { merchantName: 'Comcast', name: 'Comcast Internet Bill', categoryName: 'bills_and_utilities', minAmount: 59.99, maxAmount: 129.99, channel: 'ONLINE', pfcPrimary: 'RENT_AND_UTILITIES' },
  { merchantName: 'Walgreens', name: 'Walgreens Pharmacy', categoryName: 'health', minAmount: 4, maxAmount: 65, channel: 'IN_STORE', pfcPrimary: 'MEDICAL' },
  { merchantName: 'Home Depot', name: 'Home Depot Purchase', categoryName: 'shopping', minAmount: 15, maxAmount: 400, channel: 'IN_STORE', pfcPrimary: 'HOME_IMPROVEMENT' },
];

const INSTITUTIONS = [
  { id: 'ins_1', name: 'Chase' },
  { id: 'ins_2', name: 'Bank of America' },
  { id: 'ins_3', name: 'Wells Fargo' },
  { id: 'ins_4', name: 'Citi' },
  { id: 'ins_5', name: 'Capital One' },
];

const CITIES = ['New York', 'San Francisco', 'Chicago', 'Austin', 'Seattle', 'Denver', 'Miami', 'Boston'];
const REGIONS = ['NY', 'CA', 'IL', 'TX', 'WA', 'CO', 'FL', 'MA'];

// ─── Main Seed Function ─────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── 1. Categories ────────────────────────────────────────────────────────
  console.log('  Creating categories...');
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES_DATA) {
    const created = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap.set(cat.name, created.id);
  }

  // ── 2. Merchants ─────────────────────────────────────────────────────────
  console.log('  Creating merchants...');
  const merchantMap = new Map<string, string>();
  for (const m of MERCHANTS_DATA) {
    const created = await prisma.merchant.upsert({
      where: { name: m.name },
      update: {},
      create: m,
    });
    merchantMap.set(m.name, created.id);
  }

  // ── 3. Users, PlaidItems, Accounts, Transactions ─────────────────────────
  for (const userData of USERS) {
    console.log(`  Creating user ${userData.email}...`);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        name: userData.name,
        passwordHash: TEST_PASSWORD,
      },
    });

    // Each user gets 1-2 PlaidItems
    const numItems = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < numItems; i++) {
      const institution = pick(INSTITUTIONS);
      const itemId = `item_${user.id}_${i}`;

      const plaidItem = await prisma.plaidItem.upsert({
        where: { itemId },
        update: {},
        create: {
          userId: user.id,
          accessTokenEncrypted: fakeEncryptedToken(),
          itemId,
          institutionId: institution.id,
          institutionName: institution.name,
          status: 'ACTIVE',
          webhookUrl: 'http://localhost:3000/api/webhooks/plaid',
        },
      });

      // Each PlaidItem gets 2-3 accounts
      const accountTypes: Array<{ type: AccountType; subtype: string; balMin: number; balMax: number }> = [
        { type: 'CHECKING', subtype: 'checking', balMin: 1200, balMax: 15000 },
        { type: 'SAVINGS', subtype: 'savings', balMin: 5000, balMax: 50000 },
        { type: 'CREDIT', subtype: 'credit card', balMin: 200, balMax: 5000 },
      ];

      const numAccounts = Math.random() > 0.5 ? 3 : 2;
      for (let a = 0; a < numAccounts; a++) {
        const acctDef = accountTypes[a];
        const plaidAccountId = `acct_${user.id}_${i}_${a}`;
        const currentBalance = randomAmount(acctDef.balMin, acctDef.balMax);
        const mask = String(1000 + Math.floor(Math.random() * 9000));

        const account = await prisma.account.upsert({
          where: { plaidAccountId },
          update: {},
          create: {
            userId: user.id,
            plaidItemId: plaidItem.id,
            plaidAccountId,
            name: `${institution.name} ${acctDef.subtype.charAt(0).toUpperCase() + acctDef.subtype.slice(1)}`,
            officialName: `${institution.name} ${acctDef.subtype.charAt(0).toUpperCase() + acctDef.subtype.slice(1)} Account`,
            type: acctDef.type,
            subtype: acctDef.subtype,
            mask,
            currentBalance,
            availableBalance: acctDef.type === 'CREDIT' ? null : currentBalance - randomAmount(0, 200),
            limitAmount: acctDef.type === 'CREDIT' ? randomAmount(5000, 20000) : null,
            isoCurrencyCode: 'USD',
            lastSyncedAt: new Date(),
          },
        });

        // Each account gets 50-100 transactions over the last 90 days
        const numTx = 50 + Math.floor(Math.random() * 51);
        console.log(`    Creating ${numTx} transactions for ${account.name}...`);

        for (let t = 0; t < numTx; t++) {
          const template = pick(TX_TEMPLATES);
          const plaidTxId = `tx_${account.id}_${t}`;
          const hash = txHash(plaidTxId, account.id);
          const date = randomDateWithinDays(90);
          const amount = randomAmount(template.minAmount, template.maxAmount);
          const cityIdx = Math.floor(Math.random() * CITIES.length);

          await prisma.transaction.upsert({
            where: { plaidTransactionId: plaidTxId },
            update: {},
            create: {
              accountId: account.id,
              plaidTransactionId: plaidTxId,
              merchantId: merchantMap.get(template.merchantName) ?? null,
              categoryId: categoryMap.get(template.categoryName) ?? null,
              amount,
              name: template.name,
              merchantName: template.merchantName,
              description: `${template.name} - $${amount.toFixed(2)}`,
              date,
              authorizedDate: new Date(date.getTime() - 86400000), // day before
              pending: Math.random() < 0.05, // 5% pending
              paymentChannel: template.channel,
              transactionType: 'place',
              isoCurrencyCode: 'USD',
              locationCity: CITIES[cityIdx],
              locationRegion: REGIONS[cityIdx],
              locationCountry: 'US',
              personalFinanceCategoryPrimary: template.pfcPrimary,
              personalFinanceCategoryDetailed: `${template.pfcPrimary}_OTHER`,
              hash,
            },
          });
        }
      }
    }
  }

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
