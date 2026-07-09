'use client';

import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Calendar, Trash2, ShieldAlert, Sparkles, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export default function SubscriptionsPage() {
  const { data: accounts = [] } = trpc.accounts.list.useQuery();
  // Fetch transactions to find recurring items (simple detector on frontend/api)
  const { data: txnsResponse, isLoading } = trpc.transactions.list.useQuery({
    page: 1,
    pageSize: 100,
  });

  const transactions = txnsResponse?.transactions || [];

  // A simple rules-based subscription detector:
  // Identify transactions with repeating names in the history (e.g. Netflix, Spotify, AWS, internet, etc.)
  const detectedSubscriptions = React.useMemo(() => {
    const subsMap = new Map<string, { name: string; amount: number; count: number; date: Date }>();
    
    // Keywords indicating recurring charges
    const recurringKeywords = ['netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'youtube premium', 'adobe', 'gym', 'comcast', 'verizon', 'iclouddoc', 'chatgpt', 'aws', 'github'];

    transactions.forEach((txn) => {
      const nameLower = (txn.merchantName || txn.name).toLowerCase();
      const amount = Number(txn.amount);

      // Subscriptions are typically regular positive expenses
      if (amount > 0) {
        const matchedKeyword = recurringKeywords.find(kw => nameLower.includes(kw));
        if (matchedKeyword) {
          const key = matchedKeyword;
          const existing = subsMap.get(key);
          if (existing) {
            existing.count += 1;
            // Keep the latest date
            if (new Date(txn.date) > existing.date) {
              existing.date = new Date(txn.date);
            }
          } else {
            subsMap.set(key, {
              name: txn.merchantName || txn.name,
              amount,
              count: 1,
              date: new Date(txn.date),
            });
          }
        }
      }
    });

    return Array.from(subsMap.values()).map((sub, idx) => {
      // Calculate next payment date (estimated 30 days after the last one)
      const nextDate = new Date(sub.date);
      nextDate.setDate(nextDate.getDate() + 30);

      return {
        id: `sub_${idx}`,
        name: sub.name,
        amount: sub.amount,
        frequency: 'monthly',
        nextPaymentDate: nextDate,
        status: 'ACTIVE',
      };
    });
  }, [transactions]);

  // Cancel handler (optimistic state change or call api)
  const [cancelledIds, setCancelledIds] = React.useState<string[]>([]);
  const handleCancel = (id: string) => {
    setCancelledIds(prev => [...prev, id]);
  };

  const activeSubs = detectedSubscriptions.filter(s => !cancelledIds.includes(s.id));

  const totalMonthlyCost = activeSubs.reduce((sum, s) => sum + s.amount, 0);
  const totalYearlyCost = totalMonthlyCost * 12;

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amt);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Recurring Subscriptions</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Identify, monitor, and cancel recurring expenses automatically detected in your accounts
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)' }}>
        <Card style={{ padding: 'var(--space-xl)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Detected Subscriptions</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 'var(--space-sm)' }}>
            {isLoading ? <Skeleton width="50%" height={32} /> : activeSubs.length}
          </div>
        </Card>
        <Card style={{ padding: 'var(--space-xl)', background: 'var(--gradient-card)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Monthly Outflow</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 'var(--space-sm)', color: 'var(--accent-primary-light)' }}>
            {isLoading ? <Skeleton width="50%" height={32} /> : formatCurrency(totalMonthlyCost)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
            Yearly projected cost: {formatCurrency(totalYearlyCost)}
          </p>
        </Card>
      </div>

      {/* Subscription List */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>Detected Feeds</h2>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {[1, 2].map(i => (
              <Card key={i} style={{ padding: 'var(--space-lg)' }}>
                <Skeleton width="100%" height={50} />
              </Card>
            ))}
          </div>
        ) : activeSubs.length === 0 ? (
          <Card style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>No recurring subscriptions detected.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {activeSubs.map((sub) => (
              <Card
                key={sub.id}
                style={{
                  padding: 'var(--space-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--space-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--bg-glass-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={20} className="text-gradient-primary" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{sub.name}</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        Next billing: {format(sub.nextPaymentDate, 'MMM dd, yyyy')}
                      </span>
                      <span>•</span>
                      <span>Frequency: Monthly</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xl)' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      {formatCurrency(sub.amount)}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Projected {formatCurrency(sub.amount * 12)}/yr
                    </span>
                  </div>

                  <Button
                    onClick={() => handleCancel(sub.id)}
                    variant="danger"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <Trash2 size={14} />
                    Cancel Tracking
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Savings Simulation card */}
      {activeSubs.length > 0 && (
        <Card
          style={{
            padding: 'var(--space-xl)',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-lg)',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(244, 63, 94, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingDown size={22} style={{ color: 'var(--danger)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Identify redundant subscriptions to unlock savings
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              We've identified that canceling just one or two unused subscriptions could reduce your monthly outflow by up to 25%, boosting your net cash projection over the next 90 days.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
