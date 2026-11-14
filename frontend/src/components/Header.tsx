import React from 'react';
import {
  Layers,
  Zap,
  Radio,
  Server,
  RefreshCw,
} from 'lucide-react';
import { wsClient } from '../services/websocket';

interface HeaderProps {
  viewMode: 'split' | 'single' | 'concurrency';
  setViewMode: (mode: 'split' | 'single' | 'concurrency') => void;
  wsStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  eventCount: number;
  onRefreshAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  wsStatus,
  eventCount,
  onRefreshAll,
}) => {
  const getStatusBadge = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            WS LIVE
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            WS CONNECTING
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            WS OFFLINE
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & System Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-indigo-400 text-lg tracking-tighter">
                R
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">Resolv</h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  v2.4.1
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Distributed Lock & Real-Time Booking Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:ml-4">
            {getStatusBadge()}
            <button
              onClick={() => wsClient.connect()}
              title="WebSocket Events Received"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:border-slate-600 transition"
            >
              <Radio className="w-3 h-3 text-cyan-400" />
              <span>{eventCount} events</span>
            </button>
          </div>
        </div>

        {/* View Mode Navigation Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner w-full md:w-auto justify-center">
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'split'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Split Arena</span>
          </button>

          <button
            onClick={() => setViewMode('single')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'single'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Single Client View</span>
          </button>

          <button
            onClick={() => setViewMode('concurrency')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'concurrency'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-900/60'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Concurrency & Edge Cases</span>
          </button>
        </div>

        {/* Quick Refresh & Stats */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={onRefreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Refresh active slots and data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
