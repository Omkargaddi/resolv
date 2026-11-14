import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Slot, UserRole } from '../types';
import { getSlotsApi, blockSlotApi, unblockSlotApi, extractApiError } from '../services/api';
import { wsClient } from '../services/websocket';

interface SlotSelectorProps {
  venueId: string;
  venueName?: string;
  userRole?: UserRole;
  token: string | null;
  onSelectSlot: (slot: Slot) => void;
  refreshTrigger?: number;
}

export const SlotSelector: React.FC<SlotSelectorProps> = ({
  venueId,
  venueName = 'Main Hall',
  userRole,
  token,
  onSelectSlot,
  refreshTrigger = 0,
}) => {
  // Generate 7 upcoming date options starting from today
  const today = new Date('2026-11-14'); // Default base date for the seeded db
  const dateOptions = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSlotId, setActionSlotId] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSlotsApi(venueId, selectedDate);
      setSlots(data);
    } catch (err) {
      const { message } = extractApiError(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [venueId, selectedDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots, refreshTrigger]);

  // Subscribe to real-time WebSocket slot availability events
  useEffect(() => {
    const unsubscribe = wsClient.onEvent((event) => {
      if (event.event === 'slotAvailabilityChanged') {
        const payload = event.payload as {
          slotId: string;
          venueId: string;
          status: Slot['status'];
          remainingCapacity: number;
        };

        if (payload.venueId === venueId) {
          setSlots((prevSlots) =>
            prevSlots.map((slot) => {
              if (slot.id === payload.slotId) {
                return {
                  ...slot,
                  status: payload.status,
                  remainingCapacity: payload.remainingCapacity,
                };
              }
              return slot;
            })
          );
        }
      }
    });

    return unsubscribe;
  }, [venueId]);

  const handleToggleBlock = async (slot: Slot) => {
    if (!token) return;
    setActionSlotId(slot.id);
    try {
      if (slot.status === 'blocked') {
        await unblockSlotApi(token, slot.id);
      } else {
        await blockSlotApi(token, slot.id, 'Admin maintenance lock');
      }
      await fetchSlots();
    } catch (err) {
      const { message } = extractApiError(err);
      alert(`Admin slot action failed: ${message}`);
    } finally {
      setActionSlotId(null);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Date Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {dateOptions.map((dateStr) => {
          const dateObj = new Date(dateStr);
          const isSelected = dateStr === selectedDate;
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition shrink-0 border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              <span className="text-[10px] uppercase font-bold opacity-80">{dayName}</span>
              <span className="font-mono text-xs font-semibold">{monthDay}</span>
            </button>
          );
        })}
      </div>

      {/* Slots Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold text-slate-200">
            {venueName} — {selectedDate}
          </span>
          <span className="text-slate-500">({slots.length} slots)</span>
        </div>

        <button
          onClick={fetchSlots}
          disabled={isLoading}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
          title="Refresh slots"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Slots Grid */}
      {isLoading && slots.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="font-mono">Loading available time slots...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
          <AlertCircle className="w-6 h-6 text-slate-600" />
          <p className="font-semibold text-slate-400">No slots found for this date</p>
          <p className="text-[11px] text-slate-600">Try selecting a different date from the tabs above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map((slot) => {
            const isBlocked = slot.status === 'blocked';
            const isBooked = slot.status === 'booked' || slot.remainingCapacity <= 0;
            const isLimited = slot.remainingCapacity > 0 && slot.remainingCapacity <= 2;

            const capacityPercent = Math.round(
              ((slot.capacity - slot.remainingCapacity) / slot.capacity) * 100
            );

            return (
              <div
                key={slot.id}
                className={`group relative p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isBlocked
                    ? 'bg-purple-950/10 border-purple-500/30'
                    : isBooked
                    ? 'bg-rose-950/10 border-rose-500/20 opacity-80'
                    : isLimited
                    ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-400/50'
                    : 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 shadow-md'
                }`}
              >
                <div>
                  {/* Top Bar: Time and Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white">
                      <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                    </div>

                    {/* Status Badge */}
                    {isBlocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        Blocked
                      </span>
                    ) : isBooked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Sold Out
                      </span>
                    ) : isLimited ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                        Only {slot.remainingCapacity} Left
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Available
                      </span>
                    )}
                  </div>

                  {/* Price & Duration */}
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="font-semibold text-slate-200">
                      ${slot.price ? Number(slot.price).toFixed(2) : '0.00'} {slot.currency}
                    </span>
                    <span>{slot.durationMinutes} mins</span>
                  </div>

                  {/* Capacity Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        Remaining Seats
                      </span>
                      <span className="font-bold text-slate-200">
                        {slot.remainingCapacity} / {slot.capacity}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isBlocked
                            ? 'bg-purple-500'
                            : isBooked
                            ? 'bg-rose-500'
                            : isLimited
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${100 - capacityPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                  {/* Book Button */}
                  <button
                    onClick={() => onSelectSlot(slot)}
                    disabled={isBlocked || isBooked}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                      isBlocked || isBooked
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isBooked ? 'Full' : isBlocked ? 'Unavailable' : 'Reserve'}</span>
                  </button>

                  {/* Admin Fast Block / Unblock Action */}
                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleToggleBlock(slot)}
                      disabled={actionSlotId === slot.id}
                      className={`p-1.5 rounded-lg border text-xs transition ${
                        isBlocked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                      }`}
                      title={isBlocked ? 'Unblock slot' : 'Block slot (Admin)'}
                    >
                      {actionSlotId === slot.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : isBlocked ? (
                        <Unlock className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SlotSelector;
