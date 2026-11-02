import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary font-mono transition-colors ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
