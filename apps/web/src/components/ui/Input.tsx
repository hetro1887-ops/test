import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, wrapperClassName, className, ...props }, ref) => {
    return (
      <div className={clsx('input-wrapper', wrapperClassName)}>
        {label && <label className="input-label">{label}</label>}
        <div className={icon ? 'input-icon' : undefined}>
          {icon && icon}
          <input
            ref={ref}
            className={clsx('input', error && 'input-error', className)}
            {...props}
          />
        </div>
        {error && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--danger-light)',
              marginTop: '2px',
            }}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
