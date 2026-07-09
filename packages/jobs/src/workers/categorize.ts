import { Job } from 'bullmq';
import { prisma } from '@finance/db';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Rule-based fallback keywords
const KEYWORD_RULES: Record<string, string[]> = {
  'Food & Dining': ['restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'sushi', 'doordash', 'grubhub', 'uber eats', 'starbucks', 'mcdonald', 'chipotle', 'subway', 'panera', 'taco bell', 'wendy', 'chick-fil-a', 'dunkin'],
  'Shopping': ['amazon', 'walmart', 'target', 'best buy', 'apple store', 'nike', 'nordstrom', 'macy', 'costco', 'home depot', 'ikea', 'etsy', 'ebay'],
  'Transportation': ['uber', 'lyft', 'taxi', 'parking', 'toll', 'transit', 'metro', 'bus', 'train', 'amtrak'],
  'Entertainment': ['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'cinema', 'movie', 'theater', 'concert', 'gaming', 'xbox', 'playstation', 'steam'],
  'Bills & Utilities': ['electric', 'water', 'gas bill', 'internet', 'phone bill', 'comcast', 'verizon', 'at&t', 't-mobile', 'utility', 'sewage', 'trash', 'insurance'],
  'Health & Fitness': ['pharmacy', 'cvs', 'walgreens', 'gym', 'fitness', 'doctor', 'hospital', 'dental', 'medical', 'health'],
  'Travel': ['airline', 'hotel', 'airbnb', 'booking', 'expedia', 'marriott', 'hilton', 'delta', 'united', 'american airlines', 'southwest'],
  'Income': ['payroll', 'direct deposit', 'salary', 'wage', 'interest earned', 'dividend', 'refund'],
  'Transfer': ['transfer', 'zelle', 'venmo', 'cash app', 'paypal', 'wire', 'ach'],
  'Groceries': ['whole foods', 'trader joe', 'kroger', 'safeway', 'publix', 'aldi', 'grocery', 'market'],
  'Gas & Fuel': ['shell', 'chevron', 'exxon', 'bp', 'gas station', 'fuel', 'speedway', 'wawa'],
  'Education': ['tuition', 'university', 'college', 'school', 'udemy', 'coursera', 'textbook'],
  'Personal Care': ['salon', 'barber', 'spa', 'beauty', 'nail', 'skincare', 'sephora']
};

/**
 * Perform local fallback keyword matching categorization.
 */
function localRuleBasedPredict(description: string, amount: number): { category: string; confidence: number } {
  const text = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(KEYWORD_RULES)) {
    for (const kw of keywords) {
      if (text.includes(kw)) {
        return { category, confidence: 0.85 };
      }
    }
  }

  // Heuristic for income
  if (amount < 0) {
    return { category: 'Income', confidence: 0.7 };
  }

  return { category: 'Shopping', confidence: 0.3 }; // Default category
}

export async function handleCategorizeJob(job: Job<{ transactionId: string }>) {
  const { transactionId } = job.data;
  console.log(`[Categorize Worker] Processing transaction: ${transactionId}`);

  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!txn) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  // If user already manually categorized, don't overwrite it
  if (txn.categoryId && !txn.mlCategory) {
    console.log(`[Categorize Worker] Transaction already manually categorized. Skipping.`);
    return;
  }

  let predictedCategory = 'Shopping';
  let confidence = 0.3;

  try {
    // Attempt calling FastAPI ML API
    console.log(`[Categorize Worker] Calling ML service for description: "${txn.name}"`);
    
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: txn.description || txn.name,
        amount: Math.abs(Number(txn.amount)),
        merchant_name: txn.merchantName || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      predictedCategory = data.category;
      confidence = data.confidence;
      console.log(`[Categorize Worker] ML prediction: ${predictedCategory} (confidence: ${confidence})`);
    } else {
      console.warn(`[Categorize Worker] ML API returned status ${response.status}. Falling back to rule-based prediction.`);
      const fallback = localRuleBasedPredict(txn.name, Number(txn.amount));
      predictedCategory = fallback.category;
      confidence = fallback.confidence;
    }
  } catch (error) {
    console.error('[Categorize Worker] ML API call failed. Falling back to rule-based prediction.', error);
    const fallback = localRuleBasedPredict(txn.name, Number(txn.amount));
    predictedCategory = fallback.category;
    confidence = fallback.confidence;
  }

  // Find category in the database by name (case-insensitive)
  let category = await prisma.category.findUnique({
    where: { name: predictedCategory },
  });

  if (!category) {
    // If not found, look up by displayName
    category = await prisma.category.findFirst({
      where: { displayName: { equals: predictedCategory, mode: 'insensitive' } },
    });
  }

  if (!category) {
    // Fallback: Create category dynamically
    category = await prisma.category.create({
      data: {
        name: predictedCategory,
        displayName: predictedCategory,
        icon: 'HelpCircle',
        color: '#94a3b8',
        isSystem: false,
      },
    });
  }

  // Update transaction with categorization data
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      categoryId: category.id,
      mlCategory: predictedCategory,
      mlConfidence: confidence,
    },
  });

  console.log(`[Categorize Worker] Completed categorization for transaction ${transactionId} -> ${predictedCategory}`);
}
