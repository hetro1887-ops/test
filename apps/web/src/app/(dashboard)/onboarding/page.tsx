'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlaidLink } from '@/components/PlaidLink';
import { trpc } from '@/lib/trpc';
import { CheckCircle2, Shield, Landmark, RefreshCw, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Welcome, 2: Link Bank, 3: Syncing, 4: Complete
  const [accountsCount, setAccountsCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  // tRPC query to check accounts
  const { data: accounts = [], refetch: refetchAccounts } = trpc.accounts.list.useQuery(undefined, {
    enabled: step >= 2,
  });

  useEffect(() => {
    if (accounts.length > 0 && step === 2) {
      setAccountsCount(accounts.length);
      // Link completed, move to sync
      setStep(3);
      startInitialSync();
    }
  }, [accounts, step]);

  const startInitialSync = () => {
    setSyncStatus('running');
    setSyncProgress(10);
    
    // Simulate incremental progress of the background worker sync
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 15;
      });
    }, 800);

    // Trigger sync check (since sandbox works instantly, we can just wait 4s)
    setTimeout(async () => {
      clearInterval(interval);
      try {
        await refetchAccounts();
        setSyncProgress(100);
        setSyncStatus('success');
        setStep(4);
      } catch (err) {
        console.error('Sync failed:', err);
        setSyncStatus('error');
      }
    }, 4000);
  };

  const handleFinish = () => {
    router.push('/dashboard');
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '80vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-md)',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: 'var(--space-2xl)',
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-default)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'var(--gradient-primary)',
          }}
        />

        {/* STEP 1: Welcome & Setup Intro */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bg-glass-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Shield size={28} className="text-gradient-primary" />
            </div>

            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                Welcome to FinanceFlow
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Let's set up your secure financial environment. Connect a sandbox bank account to populate transaction data instantly.
              </p>
            </div>

            <div
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                textAlign: 'left',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent-primary-light)' }}>✓</span>
                <span>Encrypted credential storage (AES-256-GCM)</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent-primary-light)' }}>✓</span>
                <span>Incremental bank feeds with sync deduplication</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent-primary-light)' }}>✓</span>
                <span>AI Categorization engine powered by DistilBERT</span>
              </div>
            </div>

            <Button onClick={() => setStep(2)} variant="primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Begin Onboarding
              <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* STEP 2: Link Plaid Link */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bg-glass-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Landmark size={28} style={{ color: 'var(--accent-secondary)' }} />
            </div>

            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                Connect Your Bank
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                Use Plaid's secure portal to log in to your financial institution.
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', background: 'var(--bg-glass)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                Test keys: Use <strong>user_good</strong> and <strong>pass_good</strong>
              </div>
            </div>

            <PlaidLink onSuccess={() => refetchAccounts()} />

            <Button onClick={() => setStep(1)} variant="ghost">
              Back
            </Button>
          </div>
        )}

        {/* STEP 3: Syncing Accounts */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bg-glass-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <RefreshCw size={28} className="animate-spin text-gradient-primary" />
            </div>

            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                Synchronizing Account Data
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                We're fetching your initial balances, running transaction deduplication, and triggering ML categorization.
              </p>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Syncing feeds...</span>
                <span>{syncProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${syncProgress}%`,
                    height: '100%',
                    background: 'var(--gradient-primary)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Completed Onboarding */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
            </div>

            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                Setup Complete!
              </h1>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Your bank credentials have been encrypted and linked successfully. We discovered{' '}
                <strong>{accountsCount}</strong> accounts.
              </p>
            </div>

            <Button onClick={handleFinish} variant="primary" style={{ width: '100%' }}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
