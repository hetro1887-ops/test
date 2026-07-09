import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'custom';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  count = 1,
}: SkeletonProps) {
  const variantClass =
    variant === 'text'
      ? 'skeleton-text'
      : variant === 'title'
      ? 'skeleton-title'
      : variant === 'avatar'
      ? 'skeleton-avatar'
      : variant === 'card'
      ? 'skeleton-card'
      : '';

  const items = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={clsx('skeleton', variantClass, className)}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
        marginBottom: count > 1 && i < count - 1 ? '8px' : undefined,
      }}
    />
  ));

  return <>{items}</>;
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px' }}>
      <Skeleton variant="avatar" />
      <div style={{ flex: 1 }}>
        <Skeleton width="60%" height={14} />
        <div style={{ marginTop: 6 }}>
          <Skeleton width="30%" height={10} />
        </div>
      </div>
      <Skeleton width={80} height={14} />
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="glass-card-static" style={{ padding: 'var(--space-xl)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Skeleton width={100} height={12} />
        <Skeleton variant="avatar" width={40} height={40} />
      </div>
      <Skeleton width="50%" height={28} />
      <div style={{ marginTop: 8 }}>
        <Skeleton width="30%" height={12} />
      </div>
    </div>
  );
}
