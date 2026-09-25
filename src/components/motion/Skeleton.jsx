/**
 * Reusable skeleton loaders that match the dimensions of real content.
 * Uses a subtle pulse animation — no layout shift, no heavy GPU work.
 */

function Pulse({ className = '', style }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} style={style} />;
}

/** Card skeleton — matches ChallengeCard dimensions */
export function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <Pulse className="h-28 w-full rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Pulse className="h-5 w-3/4" />
        <Pulse className="mt-3 h-4 w-full" />
        <Pulse className="mt-1.5 h-4 w-2/3" />
        <div className="mt-auto pt-4">
          <Pulse className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

/** Row skeleton — matches LiveNowTabs Row dimensions */
export function RowSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Pulse className="h-40 w-full rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Pulse className="h-5 w-4/5" />
        <Pulse className="mt-2 h-3 w-1/2" />
        <Pulse className="mt-3 h-3 w-2/3" />
        <Pulse className="mt-4 h-8 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Generic skeleton grid */
export function SkeletonGrid({ count = 6, cols = 'sm:grid-cols-2 lg:grid-cols-3', Skeleton = CardSkeleton }) {
  return (
    <div className={`grid gap-6 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} />)}
    </div>
  );
}

/** Stat card skeleton */
export function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Pulse className="h-4 w-20" />
      <Pulse className="mt-3 h-8 w-16" />
    </div>
  );
}

/** Text line skeleton */
export function LineSkeleton({ width = 'w-full' }) {
  return <Pulse className={`h-4 ${width}`} />;
}

export default { CardSkeleton, RowSkeleton, SkeletonGrid, StatSkeleton, LineSkeleton };