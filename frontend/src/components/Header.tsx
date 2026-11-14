import React from 'react';
import {
  Radio,
  RefreshCw,
} from 'lucide-react';
import { wsClient } from '../services/websocket';

interface HeaderProps {
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  eventCount: number;
  onRefreshAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  eventCount,
  onRefreshAll,
}) => {
  const getStatusBadge = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Connecting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#080c20]/95 backdrop-blur-md border-b border-[#1c2763] px-4 py-3 sm:px-6 shadow-lg shadow-black/20">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Brand & System Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Transparent Brand Logo in clean high-contrast container */}
            <div className="bg-white/95 px-3 py-1 rounded-xl shadow-md border border-white/30 flex items-center hover:bg-white transition">
              <img
                src="/logo_transparent.png"
                alt="Resolv"
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </div>

            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold text-[#D0E7E6] bg-[#293681]/70 border border-[#4274D9]/40">
                  v2.4.1
                </span>
                <span className="text-xs font-medium text-[#95CCDD]">
                  Enterprise Booking Platform
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live WebSocket Event Counter & Sync Controls */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}

          <button
            onClick={() => wsClient.connect()}
            title="WebSocket Events Streamed"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-[#D0E7E6] bg-[#0f1538] hover:bg-[#151e4d] border border-[#1c2763] hover:border-[#4274D9]/60 transition shadow-sm"
          >
            <Radio className="w-3.5 h-3.5 text-[#4274D9]" />
            <span>{eventCount} events</span>
          </button>

          <button
            onClick={onRefreshAll}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#293681] hover:bg-[#4274D9] text-white border border-[#4274D9]/50 transition shadow-sm hover:shadow-[#4274D9]/25"
            title="Refresh slots and bookings"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#D0E7E6]" />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
