import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  PauseCircle,
  RefreshCw,
  Server,
  Database,
  Cpu,
} from 'lucide-react';
import { QueueStats } from '../types';
import { getQueueStatsApi, getHealthApi, extractApiError } from '../../../resolv/frontend/src/services/api';

interface AdminDeckProps {
  token: string | null;
  onRefreshSlots?: () => void;
}

export const AdminDeck: React.FC<AdminDeckProps> = ({ token, onRefreshSlots }) => {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [health, setHealth] = useState<{ status: string; uptime: number; timestamp: string } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const [stats, healthRes] = await Promise.all([
        getQueueStatsApi(token),
        getHealthApi().catch(() => null),
      ]);
      setQueueStats(stats);
      if (healthRes) setHealth(healthRes);
    } catch (err) {
      const { message } = extractApiError(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? `${hrs}h ` : ''}${mins > 0 ? `${mins}m ` : ''}${secs}s`;
  };

  return (
    <div className="space-y-4">
      {/* Deck Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            <span>BullMQ Engine & System Health</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Real-time async job queues & background worker monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Auto-poll (4s)</span>
          </label>

          <button
            onClick={() => {
              fetchData();
              if (onRefreshSlots) onRefreshSlots();
            }}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Refresh queue metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* BullMQ Queue Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Waiting
          </span>
          <span className="text-xl font-mono font-bold text-blue-400 mt-1">
            {queueStats?.waiting ?? 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Active
          </span>
          <span className="text-xl font-mono font-bold text-amber-400 mt-1">
            {queueStats?.active ?? 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Completed
          </span>
          <span className="text-xl font-mono font-bold text-emerald-400 mt-1">
            {queueStats?.completed ?? 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Failed
          </span>
          <span className="text-xl font-mono font-bold text-rose-400 mt-1">
            {queueStats?.failed ?? 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            Delayed
          </span>
          <span className="text-xl font-mono font-bold text-purple-400 mt-1">
            {queueStats?.delayed ?? 0}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
            Paused
          </span>
          <span className="text-xl font-mono font-bold text-slate-400 mt-1">
            {queueStats?.paused ?? 0}
          </span>
        </div>
      </div>

      {/* System Infrastructure Specs Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">PostgreSQL 16</div>
            <div className="text-[11px] text-slate-400 font-mono">Row-Level Locks (SERIALIZABLE)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Redis 7 Cluster</div>
            <div className="text-[11px] text-slate-400 font-mono">Distributed Mutex (booking:slot:*)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Server Uptime</div>
            <div className="text-[11px] text-indigo-400 font-mono">
              {formatUptime(health?.uptime)}
            </div>
          </div>
        </div>
      </div>

      {/* Background Workers Manifest */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
        <span className="font-semibold text-slate-300">Registered BullMQ Workers</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">booking:confirmed</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Active
            </span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">booking:cancelled</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Active
            </span>
          </div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400">slot:reclaim-expired</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              */5 * * * *
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDeck;
