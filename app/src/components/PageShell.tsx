import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Tailwind max-width class. Default max-w-7xl for dashboards; use max-w-3xl for narrow pages. */
  maxWidth?: string;
  className?: string;
  /** Extra bottom padding for mobile nav clearance on pages that need it. */
  withBottomNavPad?: boolean;
}

/** Consistent page chrome: padding, max-width, optional title row, subtle enter motion. */
export default function PageShell({
  children,
  title,
  subtitle,
  actions,
  maxWidth = 'max-w-7xl',
  className,
  withBottomNavPad = false,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-[calc(100vh-60px)] bg-[#FBFBFC] page-transition',
        withBottomNavPad && 'pb-6',
        className
      )}
    >
      <div className={cn(maxWidth, 'mx-auto px-4 sm:px-6 py-6 sm:py-8')}>
        {(title || actions) && (
          <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8">
            <div className="min-w-0">
              {title && (
                <h1 className="font-serif font-medium text-3xl sm:text-4xl text-[#1E2229] tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1.5 font-sans leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}