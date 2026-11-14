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
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { QueueStats } from '../types';
import { getQueueStatsApi, getHealthApi, extractApiError } from '../services/api';

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
      <div className="flex items-center justify-between gap-3 bg-[#080c20] p-4 rounded-2xl border border-[#1c2763]">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-[#4274D9]" />
            <span>BullMQ Engine & System Health</span>
          </h4>
          <p className="text-xs text-[#95CCDD] mt-0.5">
            Real-time async job queues & background worker monitoring
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs font-medium text-[#D0E7E6] cursor-pointer select-none bg-[#0f1538] px-2.5 py-1.5 rounded-xl border border-[#1c2763]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-[#080c20] border-[#1c2763] text-[#4274D9] focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto-poll (4s)</span>
          </label>

          <button
            onClick={() => {
              fetchData();
              if (onRefreshSlots) onRefreshSlots();
            }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#0f1538] hover:bg-[#151e4d] text-[#D0E7E6] hover:text-white border border-[#1c2763] transition shadow-sm"
            title="Refresh queue metrics"
          >
            <RefreshCw className={`w-4 h-4 text-[#4274D9] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* BullMQ Queue Metrics Grid - Balanced 3x2 Grid for 1/3 column pane */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Waiting */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-[#95CCDD] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#95CCDD]" />
            Waiting
          </span>
          <span className="text-2xl font-mono font-bold text-[#95CCDD] mt-1.5">
            {queueStats?.waiting ?? 0}
          </span>
        </div>

        {/* Active */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-[#4274D9] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#4274D9]" />
            Active
          </span>
          <span className="text-2xl font-mono font-bold text-[#4274D9] mt-1.5">
            {queueStats?.active ?? 0}
          </span>
        </div>

        {/* Completed */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Completed
          </span>
          <span className="text-2xl font-mono font-bold text-emerald-400 mt-1.5">
            {queueStats?.completed ?? 0}
          </span>
        </div>

        {/* Failed */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Failed
          </span>
          <span className="text-2xl font-mono font-bold text-rose-400 mt-1.5">
            {queueStats?.failed ?? 0}
          </span>
        </div>

        {/* Delayed */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-[#D0E7E6] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D0E7E6]" />
            Delayed
          </span>
          <span className="text-2xl font-mono font-bold text-[#D0E7E6] mt-1.5">
            {queueStats?.delayed ?? 0}
          </span>
        </div>

        {/* Paused */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex flex-col justify-between shadow-sm">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
            Paused
          </span>
          <span className="text-2xl font-mono font-bold text-slate-400 mt-1.5">
            {queueStats?.paused ?? 0}
          </span>
        </div>
      </div>

      {/* System Infrastructure Specs Cards - Stacked with clean typography to prevent text truncation */}
      <div className="space-y-2.5">
        {/* PostgreSQL 16 */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>PostgreSQL 16</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xs text-[#95CCDD] font-mono truncate">Row-Level Locks (SERIALIZABLE)</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
            Healthy
          </span>
        </div>

        {/* Redis 7 */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#293681]/40 border border-[#4274D9]/40 flex items-center justify-center text-[#95CCDD] shrink-0">
              <Cpu className="w-4 h-4 text-[#4274D9]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Redis 7 Memory Store</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs text-[#95CCDD] font-mono truncate">Distributed Mutex (booking:slot:*)</div>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#293681] text-[#D0E7E6] border border-[#4274D9]/40 shrink-0">
            Active
          </span>
        </div>

        {/* Server Uptime */}
        <div className="p-3 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#4274D9]/20 border border-[#4274D9]/30 flex items-center justify-center text-[#4274D9] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Server Uptime</div>
              <div className="text-xs text-[#95CCDD] font-mono">Status: {health?.status || 'ok'}</div>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#080c20] text-[#D0E7E6] border border-[#1c2763] shrink-0">
            {formatUptime(health?.uptime)}
          </span>
        </div>
      </div>

      {/* Background Workers Manifest */}
      <div className="p-4 rounded-2xl bg-[#080c20] border border-[#1c2763] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4274D9]" />
            <span>Registered BullMQ Workers</span>
          </span>
          <span className="text-xs font-mono text-[#95CCDD]">3 workers</span>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-3.5 h-3.5 text-[#4274D9] shrink-0" />
              <span className="text-[#D0E7E6] font-semibold truncate">booking:confirmed</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              Active
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-3.5 h-3.5 text-[#4274D9] shrink-0" />
              <span className="text-[#D0E7E6] font-semibold truncate">booking:cancelled</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              Active
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0f1538] border border-[#1c2763] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-[#95CCDD] shrink-0" />
              <span className="text-[#D0E7E6] font-semibold truncate">slot:reclaim-expired</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#293681] text-[#D0E7E6] border border-[#4274D9]/40 shrink-0">
              */5 * * * *
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDeck;
