import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StateLoadingProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

/** Centered NestMate loading spinner with accessible status. */
export default function StateLoading({
  label = 'Loading...',
  className,
  fullScreen = false,
}: StateLoadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 bg-parchment',
        fullScreen ? 'min-h-screen' : 'py-16',
        className
      )}
      role="status"
      aria-label={label}
    >
      <Loader2 className="w-8 h-8 text-fire animate-spin" aria-hidden />
      <p className="text-sm text-ink/40">{label}</p>
    </div>
  );
}

interface StateSkeletonGridProps {
  count?: number;
  className?: string;
}

/** Card placeholder grid using NestMate shimmer. */
export function StateSkeletonGrid({ count = 6, className }: StateSkeletonGridProps) {
  return (
    <div
      className={cn('grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5', className)}
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-nestmate overflow-hidden">
          <div className="aspect-[4/3] skeleton-shimmer" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-2/3 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
            <div className="h-3 w-full rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
