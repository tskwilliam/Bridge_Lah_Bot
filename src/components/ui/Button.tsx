import type { ButtonHTMLAttributes } from 'react';
export function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'gold' }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}
