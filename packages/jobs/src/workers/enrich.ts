import { Job } from 'bullmq';
import { prisma } from '@finance/db';

// Static mapping of common merchant keywords to domain names for logo fetch
const MERCHANT_DOMAINS: Record<string, string> = {
  starbucks: 'starbucks.com',
  amazon: 'amazon.com',
  walmart: 'walmart.com',
  target: 'target.com',
  uber: 'uber.com',
  lyft: 'lyft.com',
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  wholefoods: 'wholefoodsmarket.com',
  costco: 'costco.com',
  mcdonald: 'mcdonalds.com',
  subway: 'subway.com',
  verizon: 'verizon.com',
  comcast: 'xfinity.com',
  hulu: 'hulu.com',
  steam: 'steampowered.com',
  airbnb: 'airbnb.com',
  shell: 'shell.com',
  chevron: 'chevron.com',
  bp: 'bp.com',
  cvs: 'cvs.com',
  walgreens: 'walgreens.com',
  targetm: 'target.com'
};

/**
 * Normalizes merchant name by removing common noise: card numbers, store IDs, locations.
 */
function cleanMerchantName(rawName: string): string {
  let name = rawName.toLowerCase();
  
  // Remove card transactions indicators (e.g., "xx1234", "*1234", "#1234")
  name = name.replace(/\b(xx+|[\*#])\d+\b/g, '');
  
  // Remove generic tags like "INC", "CO", "LLC", "LTD"
  name = name.replace(/\b(inc|co|llc|ltd|corp|corporation|usa|us)\b/g, '');

  // Remove locations like cities/state codes (e.g. "NEW YORK NY", "SEATTLE WA")
  // Simple heuristic: remove trailing 2-letter state codes and trailing words
  name = name.replace(/\b[a-z]{2}\b$/g, '');
  
  // Remove special characters and clean up whitespaces
  name = name.replace(/[^a-z0-9\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').strip ?? name.trim();

  // Capitalize first letter of each word
  return name
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Attempts to resolve a domain name for a cleaned merchant name.
 */
function resolveMerchantDomain(cleanName: string): string | null {
  const normalizedKey = cleanName.toLowerCase().replace(/\s+/g, '');
  
  for (const [kw, domain] of Object.entries(MERCHANT_DOMAINS)) {
    if (normalizedKey.includes(kw)) {
      return domain;
    }
  }

  // Fallback guess: if it looks like single word, try name.com
  if (/^[a-z0-9]+$/i.test(normalizedKey) && normalizedKey.length > 3) {
    return `${normalizedKey}.com`;
  }

  return null;
}

export async function handleEnrichJob(job: Job<{ transactionId: string }>) {
  const { transactionId } = job.data;
  console.log(`[Enrich Worker] Processing transaction: ${transactionId}`);

  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!txn) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  // Raw name to process
  const rawMerchantName = txn.merchantName || txn.name;
  const cleanedName = cleanMerchantName(rawMerchantName);
  
  // Resolve domain and Clearbit logo URL
  const domain = resolveMerchantDomain(cleanedName);
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

  // Find or create merchant
  let merchant = await prisma.merchant.findUnique({
    where: { name: cleanedName },
  });

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        name: cleanedName,
        displayName: cleanedName,
        logoUrl,
        website: domain ? `https://${domain}` : null,
      },
    });
  } else if (logoUrl && !merchant.logoUrl) {
    // Update logo if now resolved
    merchant = await prisma.merchant.update({
      where: { id: merchant.id },
      data: { logoUrl, website: domain ? `https://${domain}` : null },
    });
  }

  // Update transaction with merchant link and normalized merchantName
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      merchantId: merchant.id,
      merchantName: merchant.displayName,
    },
  });

  console.log(`[Enrich Worker] Completed enrichment for transaction ${transactionId} -> Merchant: ${merchant.displayName}`);
}
