import React from 'react';
import clsx from 'clsx';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'badge badge-primary',
  secondary: 'badge badge-secondary',
  success: 'badge badge-success',
  danger: 'badge badge-danger',
  warning: 'badge badge-warning',
  neutral: 'badge badge-neutral',
};

// Map common category names to badge variants
const categoryVariantMap: Record<string, BadgeVariant> = {
  food: 'primary',
  'food & drink': 'primary',
  dining: 'primary',
  groceries: 'primary',
  shopping: 'secondary',
  entertainment: 'secondary',
  travel: 'warning',
  transportation: 'warning',
  transfer: 'neutral',
  income: 'success',
  salary: 'success',
  health: 'danger',
  healthcare: 'danger',
  utilities: 'neutral',
  bills: 'neutral',
  rent: 'danger',
  housing: 'danger',
  education: 'primary',
  subscriptions: 'secondary',
};

export function Badge({ children, variant = 'neutral', className, dot }: BadgeProps) {
  return (
    <span className={clsx(variantClasses[variant], className)}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const variant = categoryVariantMap[category.toLowerCase()] ?? 'neutral';
  return (
    <Badge variant={variant} dot>
      {category}
    </Badge>
  );
}
