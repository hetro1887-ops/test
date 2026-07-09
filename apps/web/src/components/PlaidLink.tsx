'use client';

import React from 'react';
import { usePlaid } from '@/hooks/usePlaid';
import { Button } from './ui/Button';
import { Shield, RefreshCw } from 'lucide-react';

interface PlaidLinkProps {
  onSuccess?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function PlaidLink({ onSuccess, className, variant = 'primary', children }: PlaidLinkProps) {
  const { openLink, loading, error } = usePlaid({
    onSuccess,
  });

  return (
    <div className="plaid-link-container" style={{ width: '100%' }}>
      <Button
        onClick={() => openLink()}
        disabled={loading}
        variant={variant as any}
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
        }}
      >
        {loading ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            Connecting...
          </>
        ) : (
          children || (
            <>
              <Shield size={16} />
              Connect Bank Account
            </>
          )
        )}
      </Button>

      {error && (
        <div
          className="error-message"
          style={{
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginTop: '8px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
export default PlaidLink;
