import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  BookmarkCheck,
} from 'lucide-react';
import { Slot, UserRole } from '../types';
import { getSlotsApi, blockSlotApi, unblockSlotApi, extractApiError } from '../services/api';
import { wsClient } from '../services/websocket';

interface SlotSelectorProps {
  venueId: string;
  venueName?: string;
  userRole?: UserRole;
  token: string | null;
  selectedDate: string;
  onSelectSlot: (slot: Slot) => void;
  refreshTrigger?: number;
  onDataMutated?: () => void;
}

export const SlotSelector: React.FC<SlotSelectorProps> = ({
  venueId,
  venueName = 'Main Hall',
  userRole,
  token,
  selectedDate,
  onSelectSlot,
  refreshTrigger = 0,
  onDataMutated,
}) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSlotId, setActionSlotId] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!selectedDate) return;
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
    if (!token) {
      alert('Admin token required to block/unblock slots.');
      return;
    }

    setActionSlotId(slot.id);
    const prevStatus = slot.status;
    const isCurrentlyBlocked = prevStatus === 'blocked';
    const nextStatus = isCurrentlyBlocked ? 'available' : 'blocked';

    // Instant optimistic update for 0ms visual feedback
    setSlots((prev) =>
      prev.map((s) => (s.id === slot.id ? { ...s, status: nextStatus } : s))
    );

    try {
      if (isCurrentlyBlocked) {
        await unblockSlotApi(token, slot.id);
      } else {
        await blockSlotApi(token, slot.id, 'Admin maintenance hold');
      }
      if (onDataMutated) onDataMutated();
      await fetchSlots();
    } catch (err) {
      // Revert optimistic update on failure
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, status: prevStatus } : s))
      );
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

  // Format date display for subheader
  const formattedSelectedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-sm text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Slots List */}
      {isLoading && slots.length === 0 ? (
        <div className="py-20 text-center text-[#95CCDD] text-sm flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-[#4274D9]" />
          <span className="font-mono">Loading available slots...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="py-16 text-center text-[#95CCDD] text-sm flex flex-col items-center justify-center gap-3 bg-[#0a0e28]/50 rounded-2xl border border-dashed border-[#1c2763]">
          <AlertCircle className="w-6 h-6 text-[#4274D9]" />
          <p className="font-semibold text-white">No slots available for this date</p>
          <p className="text-xs text-[#95CCDD]">Select another day from the universal picker above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
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
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3.5 ${
                  isBlocked
                    ? 'bg-[#0b1028]/60 border-rose-500/30 shadow-inner'
                    : isBooked
                    ? 'bg-[#0b1028]/60 border-[#1c2763]/80 opacity-75'
                    : isLimited
                    ? 'bg-[#0f1538] border-amber-500/40 hover:border-amber-500/70 shadow-sm'
                    : 'bg-[#0f1538] border-[#1c2763] hover:border-[#4274D9]/60 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Header: Time, Duration & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-4 h-4 text-[#4274D9] shrink-0" />
                    <span className="font-mono text-sm font-bold text-white whitespace-nowrap">
                      {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                    </span>
                    <span className="text-xs font-medium text-[#95CCDD] whitespace-nowrap">
                      ({slot.durationMinutes}m)
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isBlocked ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-rose-500/15 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-rose-400" />
                      Locked
                    </span>
                  ) : isBooked ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#1c2763] text-[#D0E7E6] border border-[#293681]">
                      Sold Out
                    </span>
                  ) : isLimited ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/40">
                      {slot.remainingCapacity} left
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Available
                    </span>
                  )}
                </div>

                {/* Details: Price & Capacity */}
                <div className="flex items-center justify-between text-sm text-[#95CCDD] border-t border-[#1c2763]/80 pt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-white font-mono">
                      ${slot.price ? Number(slot.price).toFixed(2) : '0.00'}
                    </span>
                    <span className="text-xs font-semibold text-[#95CCDD] uppercase tracking-wider">{slot.currency}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono font-medium text-[#D0E7E6]">
                    <Users className="w-4 h-4 text-[#4274D9]" />
                    <span>
                      {slot.remainingCapacity} / {slot.capacity} seats left
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="w-full h-1.5 bg-[#090d24] rounded-full overflow-hidden border border-[#1c2763]/50">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isBlocked
                        ? 'bg-rose-500/60'
                        : isBooked
                        ? 'bg-slate-600'
                        : isLimited
                        ? 'bg-amber-400'
                        : 'bg-[#4274D9]'
                    }`}
                    style={{ width: `${100 - capacityPercent}%` }}
                  />
                </div>

                {/* Actions Bar */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={() => onSelectSlot(slot)}
                    disabled={isBlocked || isBooked}
                    className={`flex-1 py-2 px-3.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
                      isBlocked || isBooked
                        ? 'bg-[#090d22] text-slate-500 cursor-not-allowed border border-[#1c2763]/60'
                        : 'bg-[#4274D9] hover:bg-[#293681] text-white shadow-md shadow-[#4274D9]/20 hover:shadow-none'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>{isBooked ? 'Sold Out' : isBlocked ? 'Unavailable' : 'Reserve Slot'}</span>
                  </button>

                  {/* Admin Lock/Unlock Button with unambiguous state and immediate feedback */}
                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleToggleBlock(slot)}
                      disabled={actionSlotId === slot.id}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border shadow-sm ${
                        isBlocked
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/50'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                      }`}
                      title={isBlocked ? 'Click to Unlock this slot' : 'Click to Lock this slot'}
                    >
                      {actionSlotId === slot.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-[#95CCDD]" />
                      ) : isBlocked ? (
                        <>
                          <Lock className="w-4 h-4 text-rose-400" />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 text-emerald-400" />
                          <span>Unlocked</span>
                        </>
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
