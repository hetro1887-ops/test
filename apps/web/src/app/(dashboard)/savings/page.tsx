'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Target, TrendingUp, PiggyBank, RefreshCw, Send, CheckCircle } from 'lucide-react';

export default function SavingsPage() {
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [roundUpToggle, setRoundUpToggle] = useState(false);

  // tRPC state queries
  const utils = trpc.useUtils();
  const { data: goals = [], isLoading: goalsLoading } = trpc.actions.listSavingGoals.useQuery();
  const { data: suggestions = [], isLoading: suggestionsLoading } = trpc.actions.listTransferSuggestions.useQuery();

  // tRPC mutations
  const createGoalMutation = trpc.actions.createSavingGoal.useMutation({
    onSuccess: () => {
      setNewGoalName('');
      setNewGoalTarget('');
      utils.actions.listSavingGoals.invalidate();
    },
  });

  const executeTransferMutation = trpc.actions.executeTransfer.useMutation({
    onSuccess: () => {
      utils.actions.listTransferSuggestions.invalidate();
      utils.accounts.list.invalidate(); // refresh account balances on dashboard
    },
  });

  const triggerRoundUpsMutation = trpc.actions.triggerRoundUps.useMutation({
    onSuccess: (data) => {
      alert(`Automated round-ups processed! Found ${data.roundedCount} transactions. Saved ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.totalSaved)} to your saving goal.`);
      utils.actions.listSavingGoals.invalidate();
    },
  });

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName || !newGoalTarget) return;

    createGoalMutation.mutate({
      name: newGoalName,
      targetAmount: parseFloat(newGoalTarget),
      roundUpEnabled: roundUpToggle,
    });
  };

  const handleExecuteTransfer = (suggestionId: string) => {
    executeTransferMutation.mutate({ suggestionId });
  };

  const handleTriggerRoundUps = () => {
    triggerRoundUpsMutation.mutate();
  };

  const formatCurrency = (amt: number | string) => {
    const num = typeof amt === 'string' ? parseFloat(amt) : amt;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Savings Automation & Actions</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Manage your saving targets, activate transaction round-ups, and execute optimize transfers
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>
        
        {/* Left Column: Saving Goals list & creation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Saving Goals</h2>
          
          {/* Create Goal Card */}
          <Card style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>Create New Goal</h3>
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <Input
                placeholder="Goal name (e.g. Hawaii Vacation)"
                value={newGoalName}
                onChange={e => setNewGoalName(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Target amount ($)"
                value={newGoalTarget}
                onChange={e => setNewGoalTarget(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                <input
                  type="checkbox"
                  id="round-up"
                  checked={roundUpToggle}
                  onChange={e => setRoundUpToggle(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="round-up" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Enable transaction round-ups
                </label>
              </div>
              <Button type="submit" disabled={createGoalMutation.isPending} variant="primary">
                {createGoalMutation.isPending ? 'Saving...' : 'Add Goal'}
              </Button>
            </form>
          </Card>

          {/* Active Goals List */}
          {goalsLoading ? (
            <Card style={{ padding: 'var(--space-lg)' }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="100%" height={80} style={{ marginTop: '12px' }} />
            </Card>
          ) : goals.length === 0 ? (
            <Card style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)' }}>No savings goals created yet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {goals.map((goal) => {
                const current = Number(goal.currentAmount);
                const target = Number(goal.targetAmount);
                const pct = Math.min(100, Math.round((current / target) * 100));

                return (
                  <Card key={goal.id} style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ fontWeight: 700, fontSize: '1rem' }}>{goal.name}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          Round-ups: {goal.roundUpEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <Badge style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        {pct}%
                      </Badge>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>{formatCurrency(current)}</span>
                      <span>Target: {formatCurrency(target)}</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'var(--gradient-primary)',
                        }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Transfer suggestions & simulations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Action Suggestions</h2>
          
          {/* Round-up processor */}
          <Card
            style={{
              padding: 'var(--space-lg)',
              background: 'var(--gradient-card)',
              border: '1px solid var(--border-accent)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <PiggyBank size={24} className="text-gradient-primary" />
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Micro-Savings Processor</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Manually trigger transaction cents round-ups sweep
                </p>
              </div>
            </div>
            <Button
              onClick={handleTriggerRoundUps}
              disabled={triggerRoundUpsMutation.isPending}
              variant="outline"
              style={{ width: '100%' }}
            >
              Run Round-up Sweep Now
            </Button>
          </Card>

          {/* Transfer Suggestions list */}
          {suggestionsLoading ? (
            <Card style={{ padding: 'var(--space-lg)' }}>
              <Skeleton width="100%" height={80} />
            </Card>
          ) : suggestions.length === 0 ? (
            <Card style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)' }}>Your portfolio has no pending optimizations.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {suggestions.map((s) => {
                const isExecuted = s.status === 'EXECUTED';
                return (
                  <Card
                    key={s.id}
                    style={{
                      padding: 'var(--space-lg)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-md)',
                      opacity: isExecuted ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatCurrency(Number(s.amount))}</span>
                      <Badge style={{ background: isExecuted ? 'var(--success-bg)' : 'var(--warning-bg)', color: isExecuted ? 'var(--success)' : 'var(--warning)' }}>
                        {isExecuted ? 'Executed' : 'Suggested'}
                      </Badge>
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {s.reason}
                    </p>

                    {!isExecuted ? (
                      <Button
                        onClick={() => handleExecuteTransfer(s.id)}
                        disabled={executeTransferMutation.isPending}
                        variant="primary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                      >
                        {executeTransferMutation.isPending ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Authorize Plaid Transfer
                      </Button>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: 'var(--success)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle size={16} />
                        Stripe Ref: {s.executionId}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
