
import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: IconType;
  iconPosition?: 'left' | 'right';
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-accent-primary text-white hover:bg-red-700 focus:ring-accent-primary',
    secondary: 'bg-accent-secondary text-white hover:bg-opacity-90 focus:ring-accent-secondary',
    outline: 'border-2 border-surface-hover text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:ring-surface-hover',
    ghost: 'text-text-secondary hover:bg-surface-hover focus:ring-text-muted',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      {...props}
    >
      {loading ? (
        <FaSpinner className="animate-spin mr-2" size={18} />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="mr-2" size={18} />
      )}
      {children}
      {Icon && iconPosition === 'right' && !loading && <Icon className="ml-2" size={18} />}
    </button>
  );
};

export default Button;
