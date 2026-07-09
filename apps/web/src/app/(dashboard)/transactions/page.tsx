'use client';

import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Queries
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: response, isLoading, refetch } = trpc.transactions.list.useQuery({
    page,
    pageSize: 15,
    search: search || undefined,
    categoryId: selectedCategory || undefined,
  });

  const transactions = response?.transactions || [];
  const totalPages = response?.pagination.totalPages || 1;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page
  };

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setPage(1); // Reset to first page
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(num));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Transactions</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Detailed record of historical cash inflows and outflows
        </p>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by description or merchant..."
            value={search}
            onChange={handleSearchChange}
            style={{ paddingLeft: '40px' }}
          />
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
        </div>

        {/* Category selector */}
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryFilter(e.target.value)}
          style={{
            background: 'var(--bg-glass-strong)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            outline: 'none',
            minWidth: '180px',
            cursor: 'pointer',
          }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions List */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-xl)' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 'var(--space-md) 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <Skeleton width={120} height={16} />
                <Skeleton width={200} height={16} />
                <Skeleton width={80} height={16} />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
              No transactions match your filters.
            </p>
            <Button onClick={() => { setSearch(''); setSelectedCategory(''); }} variant="outline">
              Clear Filters
            </Button>
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                return (
                  <tr
                    key={txn.id}
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    className="hover-row"
                  >
                    <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {format(new Date(txn.date), 'MMM dd, yyyy')}
                    </td>
                    <td style={{ padding: 'var(--space-md)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {txn.merchantName || txn.name}
                      </div>
                      {txn.merchantName && txn.name !== txn.merchantName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {txn.name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-md)' }}>
                      <Badge
                        style={{
                          backgroundColor: txn.category?.color ? `${txn.category.color}15` : 'var(--bg-glass-strong)',
                          color: txn.category?.color || 'var(--text-secondary)',
                          border: txn.category?.color ? `1px solid ${txn.category.color}30` : '1px solid var(--border-subtle)',
                        }}
                      >
                        {txn.category?.displayName || 'Uncategorized'}
                      </Badge>
                    </td>
                    <td style={{ padding: 'var(--space-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {txn.account.name}
                    </td>
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
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-md)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <Button onClick={handlePrevPage} disabled={page === 1} variant="outline" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
              <ChevronLeft size={16} />
              Previous
            </Button>
            <Button onClick={handleNextPage} disabled={page === totalPages} variant="outline" style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export default TransactionsPage;
