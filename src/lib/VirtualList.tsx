/**
 * VirtualList — windowed rendering for large lists
 *
 * Renders only the rows visible in the viewport plus an overscan buffer,
 * keeping DOM node count constant regardless of list length.
 *
 * Features:
 *  - Variable or fixed row heights
 *  - Overscan (default 5 rows above/below viewport)
 *  - ResizeObserver for dynamic container sizing
 *  - Scroll restoration via scrollToIndex / scrollToTop refs
 *  - Mobile-optimised: passive scroll listeners, will-change: transform
 *  - Zero dependencies beyond React
 *
 * Usage:
 *   <VirtualList
 *     items={transactions}
 *     rowHeight={64}
 *     renderRow={(item, index) => <TransactionRow key={item.id} tx={item} />}
 *     className="h-[480px] overflow-y-auto"
 *   />
 */

import {
  useRef, useState, useEffect, useCallback, useMemo,
  type ReactNode, type CSSProperties,
} from 'react';

export interface VirtualListProps<T> {
  /** Full data array */
  items: T[];
  /** Fixed row height in px. Pass a function for variable heights. */
  rowHeight: number | ((index: number) => number);
  /** Render function for each visible row */
  renderRow: (item: T, index: number) => ReactNode;
  /** Number of extra rows to render above and below the visible window */
  overscan?: number;
  /** className applied to the outer scroll container */
  className?: string;
  /** style applied to the outer scroll container */
  style?: CSSProperties;
  /** Called when the user scrolls within `threshold` rows of the bottom */
  onEndReached?: () => void;
  /** Row distance from bottom that triggers onEndReached (default 5) */
  endReachedThreshold?: number;
  /** Forwarded ref — exposes scrollToIndex and scrollToTop */
  listRef?: React.RefObject<VirtualListHandle>;
  /** Empty state rendered when items.length === 0 */
  emptyState?: ReactNode;
}

export interface VirtualListHandle {
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToTop:   () => void;
}

// ── Offset cache for variable-height lists ────────────────────────────────────

function buildOffsets(count: number, rowHeight: number | ((i: number) => number)): number[] {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let i = 0; i < count; i++) {
    const h = typeof rowHeight === 'function' ? rowHeight(i) : rowHeight;
    offsets[i + 1] = offsets[i] + h;
  }
  return offsets;
}

function getRowHeight(index: number, rowHeight: number | ((i: number) => number)): number {
  return typeof rowHeight === 'function' ? rowHeight(index) : rowHeight;
}

// Binary search for the first row whose bottom edge is >= scrollTop
function findStartIndex(offsets: number[], scrollTop: number): number {
  let lo = 0, hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VirtualList<T>({
  items,
  rowHeight,
  renderRow,
  overscan = 5,
  className,
  style,
  onEndReached,
  endReachedThreshold = 5,
  listRef,
  emptyState,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);
  const [scrollTop,       setScrollTop]       = useState(0);
  const endReachedFired = useRef(false);

  // ── Container height via ResizeObserver ──────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setContainerHeight(h);
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight || 400);
    return () => ro.disconnect();
  }, []);

  // ── Scroll handler ───────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    // End-reached detection
    if (onEndReached) {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const threshold = endReachedThreshold * getRowHeight(0, rowHeight);
      if (distFromBottom < threshold && !endReachedFired.current) {
        endReachedFired.current = true;
        onEndReached();
      } else if (distFromBottom >= threshold) {
        endReachedFired.current = false;
      }
    }
  }, [onEndReached, endReachedThreshold, rowHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // ── Offset table ─────────────────────────────────────────────────────────
  const offsets = useMemo(
    () => buildOffsets(items.length, rowHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, rowHeight],
  );

  const totalHeight = offsets[items.length] ?? 0;

  // ── Visible window ────────────────────────────────────────────────────────
  const startIndex = Math.max(0, findStartIndex(offsets, scrollTop) - overscan);
  const endIndex   = useMemo(() => {
    let i = startIndex;
    while (i < items.length && offsets[i] < scrollTop + containerHeight) i++;
    return Math.min(items.length - 1, i + overscan);
  }, [startIndex, items.length, offsets, scrollTop, containerHeight, overscan]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!listRef) return;
    (listRef as React.MutableRefObject<VirtualListHandle>).current = {
      scrollToIndex: (index, align = 'start') => {
        const el = containerRef.current;
        if (!el) return;
        const top = offsets[index] ?? 0;
        const rowH = getRowHeight(index, rowHeight);
        let scrollTo = top;
        if (align === 'center') scrollTo = top - containerHeight / 2 + rowH / 2;
        if (align === 'end')    scrollTo = top - containerHeight + rowH;
        el.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
      },
      scrollToTop: () => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
    };
  }, [listRef, offsets, rowHeight, containerHeight]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (items.length === 0 && emptyState) {
    return (
      <div ref={containerRef} className={className} style={style}>
        {emptyState}
      </div>
    );
  }

  const visibleRows: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const top = offsets[i] ?? 0;
    const h   = getRowHeight(i, rowHeight);
    visibleRows.push(
      <div
        key={i}
        style={{
          position:  'absolute',
          top,
          left:      0,
          right:     0,
          height:    h,
          willChange: 'transform',
        }}
      >
        {renderRow(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        overflowY: 'auto',
        // iOS momentum scrolling
        WebkitOverflowScrolling: 'touch',
        // Prevent scroll chaining to parent on mobile
        overscrollBehavior: 'contain',
        // Tell the browser this element handles vertical panning —
        // eliminates the 300ms tap delay and enables passive scroll
        touchAction: 'pan-y',
      } as CSSProperties}
    >
      <div style={{ position: 'relative', height: totalHeight }}>
        {visibleRows}
      </div>
    </div>
  );
}

// ── Skeleton row (used as loading placeholder) ────────────────────────────────
export function VirtualListSkeleton({ rows = 8, rowHeight = 64 }: { rows?: number; rowHeight?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-white/[0.04] animate-pulse"
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}
