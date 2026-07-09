import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingMap = {
  none: '',
  sm: 'var(--space-lg)',
  md: 'var(--space-xl)',
  lg: 'var(--space-2xl)',
};

export function Card({
  children,
  className,
  hover = true,
  padding = 'md',
  onClick,
}: CardProps) {
  return (
    <div
      className={clsx(hover ? 'glass-card' : 'glass-card-static', className)}
      style={{ padding: paddingMap[padding] || undefined }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
