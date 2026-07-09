'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface CategoryData {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
}

interface MonthlyData {
  month: string;
  amount: number;
}

interface CategoryChartsProps {
  distribution: CategoryData[];
  monthlyData: MonthlyData[];
  isLoading: boolean;
}

export function CategoryCharts({ distribution, monthlyData, isLoading }: CategoryChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading || !mounted) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
        <Card style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>Loading charts...</p>
        </Card>
        <Card style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>Loading charts...</p>
        </Card>
      </div>
    );
  }

  // Filter out Income/Transfer from categories charts if amount is positive/negative
  // Just show general spending categories
  const spendingCategories = distribution
    .filter((d) => d.categoryName !== 'Income' && d.categoryName !== 'Transfer')
    .slice(0, 6);

  const totalSpending = spendingCategories.reduce((acc, curr) => acc + curr.amount, 0);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {payload[0].name}
          </p>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--space-lg)',
        width: '100%',
      }}
    >
      {/* Category distribution */}
      <Card style={{ padding: 'var(--space-lg)', height: 380, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
          Spending Distribution
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
          Total spending: {formatCurrency(totalSpending)}
        </p>

        {spendingCategories.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>No spending data recorded.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ width: '50%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendingCategories}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {spendingCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || 'var(--accent-secondary)'} />
                    ))}
                  </Pie>
                  <Tooltip content={customTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {spendingCategories.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: item.color || 'var(--accent-secondary)',
                      }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {item.categoryName}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {Math.round((item.amount / totalSpending) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Monthly spending trend */}
      <Card style={{ padding: 'var(--space-lg)', height: 380, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
          Monthly Spending
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
          Historical cash outflow
        </p>

        {monthlyData.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>No spending data recorded.</p>
          </div>
        ) : (
          <div style={{ flex: 1, width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: -10, right: 10, bottom: 0, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--text-tertiary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip content={customTooltip} />
                <Bar
                  dataKey="amount"
                  fill="url(#colorBarGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  {/* Define gradient for bar */}
                  <defs>
                    <linearGradient id="colorBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary-light)" />
                      <stop offset="100%" stopColor="var(--accent-primary)" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
export default CategoryCharts;
