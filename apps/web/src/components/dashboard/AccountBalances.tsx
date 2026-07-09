'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { CreditCard, Landmark, PiggyBank, Receipt } from 'lucide-react';

interface Account {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: string | number;
  availableBalance: string | number | null;
  isoCurrencyCode: string;
}

interface AccountBalancesProps {
  accounts: Account[];
  isLoading: boolean;
}

export function AccountBalances({ accounts, isLoading }: AccountBalancesProps) {
  const formatCurrency = (amount: number | string, code = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(num);
  };

  const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'checking':
      case 'depository':
        return <Landmark size={20} className="text-gradient-primary" />;
      case 'savings':
        return <PiggyBank size={20} style={{ color: 'var(--accent-secondary)' }} />;
      case 'credit':
        return <CreditCard size={20} style={{ color: 'var(--success)' }} />;
      default:
        return <Receipt size={20} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  if (isLoading) {
    return (
      <div className="account-balances-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)' }}>
        {[1, 2, 3].map((i) => (
          <Card key={i} style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <Skeleton circle width={40} height={40} />
              <div style={{ flex: 1 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} style={{ marginTop: '6px' }} />
              </div>
            </div>
            <Skeleton width="50%" height={24} style={{ marginTop: 'var(--space-lg)' }} />
          </Card>
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
        <p>No accounts linked yet. Use the onboarding flow to link your bank account.</p>
      </Card>
    );
  }

  return (
    <div
      className="account-balances-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-lg)',
      }}
    >
      {accounts.map((acc) => {
        const balance = acc.availableBalance !== null ? acc.availableBalance : acc.currentBalance;
        return (
          <Card
            key={acc.id}
            className="hover-card"
            style={{
              padding: 'var(--space-lg)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-md)',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-glass-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getAccountIcon(acc.type)}
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{acc.name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                    {acc.type.charAt(0).toUpperCase() + acc.type.slice(1).toLowerCase()}{' '}
                    {acc.mask ? `•••• ${acc.mask}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-lg)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {formatCurrency(balance, acc.isoCurrencyCode)}
              </div>
              {acc.availableBalance !== null && acc.availableBalance !== acc.currentBalance && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Current: {formatCurrency(acc.currentBalance, acc.isoCurrencyCode)}
                </p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
export default AccountBalances;
