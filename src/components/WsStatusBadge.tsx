/**
 * WsStatusBadge — compact connection status indicator
 *
 * Shows whether live prices are coming from WebSocket or REST polling.
 * Used in trading pages and the wallet dashboard.
 */
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { WsStatus } from '@/lib/wsManager';

interface WsStatusBadgeProps {
  status:  WsStatus;
  isLive:  boolean;
  source?: 'ws' | 'rest' | 'cache';
  className?: string;
}

export function WsStatusBadge({ status, isLive, source, className = '' }: WsStatusBadgeProps) {
  if (isLive) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 ${className}`}>
        <RefreshCw size={9} className="animate-spin" />
        Connecting
      </span>
    );
  }

  if (status === 'error' || status === 'closed') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/30 ${className}`}>
        <WifiOff size={9} />
        {source === 'rest' ? 'Polling' : 'Offline'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/30 ${className}`}>
      <Wifi size={9} />
      {source ?? 'REST'}
    </span>
  );
}
