/**
 * PageSkeleton — branded loading fallback used as the Suspense boundary
 * while lazy-loaded route chunks are being fetched.
 *
 * Two variants:
 *   <PageSkeleton />          — public pages (dark bg, gold shimmer)
 *   <PageSkeleton admin />    — admin panel (slightly different layout)
 */

interface PageSkeletonProps {
  admin?: boolean;
}

function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className}`}
      style={{ background: 'rgba(201,168,76,0.07)' }}
    />
  );
}

export default function PageSkeleton({ admin = false }: PageSkeletonProps) {
  if (admin) {
    return (
      <div className="min-h-screen flex" style={{ background: '#0A0A0A' }}>
        {/* Sidebar skeleton */}
        <div
          className="w-60 shrink-0 border-r border-white/[0.04] p-4 flex flex-col gap-3"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          {/* Logo area */}
          <Shimmer className="h-10 w-32 mb-4" />
          {/* Nav items */}
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-full" />
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-8 space-y-6">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <Shimmer className="h-7 w-48" />
            <Shimmer className="h-9 w-28" />
          </div>
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-28 w-full" />
            ))}
          </div>
          {/* Table skeleton */}
          <Shimmer className="h-10 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Public page skeleton
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      {/* Header bar */}
      <div
        className="h-[72px] border-b border-white/[0.04] flex items-center px-8 gap-6"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <Shimmer className="h-8 w-32" />
        <div className="flex-1" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-4 w-20" />
        ))}
        <Shimmer className="h-9 w-24 rounded-full" />
      </div>

      {/* Hero section */}
      <div className="px-8 pt-24 pb-16 max-w-6xl mx-auto space-y-6">
        <Shimmer className="h-4 w-32 mx-auto" />
        <Shimmer className="h-14 w-3/4 mx-auto" />
        <Shimmer className="h-14 w-1/2 mx-auto" />
        <Shimmer className="h-5 w-2/3 mx-auto" />
        <div className="flex justify-center gap-4 pt-4">
          <Shimmer className="h-12 w-40 rounded-full" />
          <Shimmer className="h-12 w-40 rounded-full" />
        </div>
      </div>

      {/* Content cards */}
      <div className="px-8 pb-16 max-w-6xl mx-auto grid grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}
