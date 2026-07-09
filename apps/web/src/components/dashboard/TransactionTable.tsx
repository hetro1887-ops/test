'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  name: string;
  merchantName: string | null;
  amount: string | number;
  date: string | Date;
  pending: boolean;
  account: {
    name: string;
    mask: string | null;
  };
  category: {
    displayName: string;
    icon: string | null;
    color: string | null;
  } | null;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
}

export function TransactionTable({ transactions, isLoading }: TransactionTableProps) {
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    // Positive numbers are debit (expenses), negative are credit (income)
    // Format nicely
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(num));
  };

  if (isLoading) {
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}><Skeleton width={50} height={14} /></th>
              <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}><Skeleton width={100} height={14} /></th>
              <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}><Skeleton width={80} height={14} /></th>
              <th style={{ padding: 'var(--space-md)', textAlign: 'left' }}><Skeleton width={80} height={14} /></th>
              <th style={{ padding: 'var(--space-md)', textAlign: 'right' }}><Skeleton width={60} height={14} /></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td style={{ padding: 'var(--space-md)' }}><Skeleton width="60px" height="14px" /></td>
                <td style={{ padding: 'var(--space-md)' }}><Skeleton width="180px" height="14px" /></td>
                <td style={{ padding: 'var(--space-md)' }}><Skeleton width="100px" height="24px" /></td>
                <td style={{ padding: 'var(--space-md)' }}><Skeleton width="90px" height="14px" /></td>
                <td style={{ padding: 'var(--space-md)', textAlign: 'right' }}><Skeleton width="70px" height="14px" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>No transactions found.</p>
      </Card>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 500 }}>Date</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 500 }}>Description</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 500 }}>Category</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontWeight: 500 }}>Account</th>
            <th style={{ padding: 'var(--space-md)', textAlign: 'right', fontWeight: 500 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const numAmount = typeof txn.amount === 'string' ? parseFloat(txn.amount) : txn.amount;
            const isExpense = numAmount > 0;
            const formattedDate = format(new Date(txn.date), 'MMM dd, yyyy');

            return (
              <tr
                key={txn.id}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background var(--transition-fast)',
                }}
                className="hover-row"
              >
                {/* Date */}
                <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {formattedDate}
                </td>

                {/* Description / Merchant */}
                <td style={{ padding: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isExpense ? 'var(--danger-bg)' : 'var(--success-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isExpense ? (
                        <ArrowUpRight size={14} style={{ color: 'var(--danger)' }} />
                      ) : (
                        <ArrowDownLeft size={14} style={{ color: 'var(--success)' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {txn.merchantName || txn.name}
                      </div>
                      {txn.merchantName && txn.name !== txn.merchantName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {txn.name}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td style={{ padding: 'var(--space-md)' }}>
                  <Badge
                    style={{
                      backgroundColor: txn.category?.color ? `${txn.category.color}15` : 'var(--bg-glass-strong)',
                      color: txn.category?.color || 'var(--text-secondary)',
                      border: txn.category?.color ? `1px solid ${txn.category.color}30` : '1px solid var(--border-subtle)',
                      fontWeight: 500,
                    }}
                  >
                    {txn.category?.displayName || 'Uncategorized'}
                  </Badge>
                </td>

                {/* Account */}
                <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {txn.account.name} {txn.account.mask ? `(••${txn.account.mask})` : ''}
                </td>

                {/* Amount */}
                <td
                  style={{
                    padding: 'var(--space-md)',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: isExpense ? 'var(--text-primary)' : 'var(--success)',
                  }}
                >
                  {isExpense ? '-' : '+'}
                  {formatCurrency(txn.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export default TransactionTable;
