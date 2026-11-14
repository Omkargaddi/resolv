import React from 'react';
import {
  RefreshCw,
} from 'lucide-react';

interface HeaderProps {
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  eventCount: number;
  onRefreshAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  onRefreshAll,
}) => {
  const getStatusBadge = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C9FDD7] text-[#134e44] border border-[#79D1C3]/60 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Connecting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#79D1C3]/30 px-4 py-3 sm:px-6 shadow-xs">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img
                src="/logo_transparent.png"
                alt="Resolv"
                className="h-17 w-auto object-contain"
              />
          </div>
        </div>

        {/* Live WebSocket Event Counter & Sync Controls */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}

          <button
            onClick={onRefreshAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#6892D5] hover:bg-[#557ec4] text-white transition shadow-xs hover:shadow-[#6892D5]/25"
            title="Refresh slots and bookings"
          >
            <RefreshCw className="w-4 h-4 text-white" />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
