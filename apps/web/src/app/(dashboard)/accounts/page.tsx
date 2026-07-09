'use client';

import React from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlaidLink } from '@/components/PlaidLink';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Landmark, Link as LinkIcon, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function AccountsPage() {
  const { data: accounts = [], isLoading, refetch } = trpc.accounts.list.useQuery();

  // Group accounts by Plaid Item (Institution)
  const itemsMap = React.useMemo(() => {
    const map = new Map<
      string,
      {
        institutionName: string;
        status: string;
        accounts: typeof accounts;
      }
    >();

    accounts.forEach((acc) => {
      const itemId = acc.plaidItemId;
      if (!map.has(itemId)) {
        map.set(itemId, {
          institutionName: acc.plaidItem.institutionName,
          status: acc.plaidItem.status,
          accounts: [],
        });
      }
      map.get(itemId)!.accounts.push(acc);
    });

    return Array.from(map.entries()).map(([id, val]) => ({
      itemId: id,
      ...val,
    }));
  }, [accounts]);

  const formatCurrency = (amount: number | string, code = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).format(num);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Linked Accounts</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Manage your credentials and view connection health
          </p>
        </div>
        <div style={{ width: 'auto', minWidth: '180px' }}>
          <PlaidLink onSuccess={() => refetch()} variant="primary">
            <LinkIcon size={16} />
            Connect New Bank
          </PlaidLink>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {[1, 2].map((i) => (
            <Card key={i} style={{ padding: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                <Skeleton width="40%" height={24} />
                <Skeleton width="15%" height={24} />
              </div>
              <Skeleton width="100%" height={80} />
            </Card>
          ))}
        </div>
      ) : itemsMap.length === 0 ? (
        <Card style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-glass-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: 'var(--space-lg)' }}>
            <Landmark size={24} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>No Bank Connections</h3>
          <p style={{ color: 'var(--text-tertiary)', maxWidth: '360px', margin: '0 auto', marginBottom: 'var(--space-xl)', fontSize: '0.9rem' }}>
            To get started, secure link your bank credentials. We support major financial institutions via Plaid.
          </p>
          <div style={{ maxWidth: '240px', margin: '0 auto' }}>
            <PlaidLink onSuccess={() => refetch()} />
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          {itemsMap.map((item) => (
            <Card
              key={item.itemId}
              style={{
                padding: 'var(--space-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-lg)',
              }}
            >
              {/* Institution Title & Status Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 'var(--space-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
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
                    <Landmark size={20} className="text-gradient-primary" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{item.institutionName}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      Credential ID: {item.itemId}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.status === 'ACTIVE' ? (
                    <Badge style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)', gap: '4px', display: 'flex', alignItems: 'center' }}>
                      <ShieldCheck size={12} />
                      Connected
                    </Badge>
                  ) : (
                    <Badge style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(244, 63, 94, 0.2)', gap: '4px', display: 'flex', alignItems: 'center' }}>
                      <AlertTriangle size={12} />
                      Fix Connection
                    </Badge>
                  )}
                </div>
              </div>

              {/* Sub Accounts List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {item.accounts.map((acc) => {
                  const balance = acc.availableBalance !== null ? acc.availableBalance : acc.currentBalance;
                  return (
                    <div
                      key={acc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 'var(--space-md)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{acc.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          {acc.type.charAt(0) + acc.type.slice(1).toLowerCase()} {acc.mask ? `•••• ${acc.mask}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>
                          {formatCurrency(balance, acc.isoCurrencyCode)}
                        </div>
                        {acc.lastSyncedAt && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            Synced {format(new Date(acc.lastSyncedAt), 'MMM dd, HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
