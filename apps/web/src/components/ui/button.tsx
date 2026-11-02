import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-control transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none';

    const variants = {
      primary:
        'bg-primary text-black font-semibold hover:bg-primary-hover shadow-sm',
      secondary:
        'bg-surface-elevated text-text-primary border border-border hover:bg-surface-hover hover:border-border-focus',
      danger:
        'bg-status-error/15 text-status-error border border-status-error/30 hover:bg-status-error/25',
      ghost:
        'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
      outline:
        'border border-border text-text-primary hover:bg-surface-elevated',
    };

    const sizes = {
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-3.5 py-2 text-xs gap-2',
      lg: 'px-4 py-2.5 text-sm gap-2.5',
      icon: 'p-2 aspect-square',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
