'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    fullWidth?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

const BASE_CLASSES =
    'relative inline-flex items-center justify-center gap-2 font-medium rounded-md ' +
    'transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'disabled:opacity-50 disabled:pointer-events-none';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-surface text-primary-text border border-border hover:bg-background',
    ghost: 'bg-transparent text-primary-text hover:bg-background',
    danger: 'bg-danger text-white hover:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm md:text-base',
    lg: 'h-12 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = 'primary',
        size = 'md',
        isLoading = false,
        fullWidth = false,
        leftIcon,
        rightIcon,
        className = '',
        type = 'button',
        disabled,
        children,
        ...rest
    },
    ref,
) {
    const classes =
        BASE_CLASSES +
        ' ' +
        VARIANT_CLASSES[variant] +
        ' ' +
        SIZE_CLASSES[size] +
        (fullWidth ? ' w-full' : '') +
        (className ? ' ' + className : '');

    return (
        <button
            ref={ref}
            type={type}
            className={classes}
            disabled={disabled || isLoading}
            aria-busy={isLoading}
            {...rest}
        >
      <span
          className={
              'inline-flex items-center justify-center gap-2' +
              (isLoading ? ' invisible' : '')
          }
      >
        {!isLoading && leftIcon}
          {children}
          {!isLoading && rightIcon}
      </span>
            {isLoading && (
                <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
            )}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
