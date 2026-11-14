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
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-sm text-rose-700 font-mono">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Slots List */}
      {isLoading && slots.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#6892D5]" />
          <span className="font-mono text-sm">Loading available slots...</span>
        </div>
      ) : slots.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-dashed border-[#79D1C3]/50 p-6">
          <AlertCircle className="w-8 h-8 text-[#6892D5]" />
          <p className="font-bold text-base text-slate-800">No slots available for this date</p>
          <p className="text-sm text-slate-500">Select another day from the universal picker above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
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
                className={`p-4.5 rounded-2xl border transition-all flex flex-col justify-between gap-4 shadow-xs hover:shadow-md ${
                  isBlocked
                    ? 'bg-rose-50/40 border-rose-200'
                    : isBooked
                    ? 'bg-slate-50/70 border-slate-200 opacity-80'
                    : isLimited
                    ? 'bg-amber-50/20 border-amber-300'
                    : 'bg-white border-[#79D1C3]/35 hover:border-[#6892D5]/70'
                }`}
              >
                {/* Header: Time, Duration & Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-4 h-4 text-[#6892D5] shrink-0" />
                    <span className="font-mono text-base font-bold text-slate-800 whitespace-nowrap">
                      {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                      ({slot.durationMinutes}m)
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isBlocked ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1.5 shadow-xs">
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      Locked
                    </span>
                  ) : isBooked ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-slate-100 text-slate-600 border border-slate-300 shadow-xs">
                      Sold Out
                    </span>
                  ) : isLimited ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                      {slot.remainingCapacity} left
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-[#C9FDD7] text-[#134e44] border border-[#79D1C3]/60 shadow-xs">
                      Available
                    </span>
                  )}
                </div>

                {/* Details: Price & Capacity */}
                <div className="flex items-center justify-between text-sm text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-slate-900 font-mono">
                      ${slot.price ? Number(slot.price).toFixed(2) : '0.00'}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{slot.currency}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-mono font-semibold text-slate-700">
                    <Users className="w-4 h-4 text-[#6892D5]" />
                    <span>
                      {slot.remainingCapacity} / {slot.capacity} seats left
                    </span>
                  </div>
                </div>

                {/* Capacity Progress Bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isBlocked
                        ? 'bg-rose-400'
                        : isBooked
                        ? 'bg-slate-400'
                        : isLimited
                        ? 'bg-amber-400'
                        : 'bg-[#6892D5]'
                    }`}
                    style={{ width: `${100 - capacityPercent}%` }}
                  />
                </div>

                {/* Actions Bar */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={() => onSelectSlot(slot)}
                    disabled={isBlocked || isBooked}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                      isBlocked || isBooked
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'bg-[#6892D5] hover:bg-[#557ec4] text-white shadow-xs hover:shadow-md shadow-[#6892D5]/20'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>{isBooked ? 'Sold Out' : isBlocked ? 'Unavailable' : 'Reserve Slot'}</span>
                  </button>

                  {/* Admin Lock/Unlock Button with unambiguous action state and immediate feedback */}
                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleToggleBlock(slot)}
                      disabled={actionSlotId === slot.id}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs ${
                        isBlocked
                          ? 'bg-[#C9FDD7] hover:bg-[#b2f8c5] text-[#134e44] border-[#79D1C3]'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                      }`}
                      title={isBlocked ? 'Click to Unlock this slot' : 'Click to Lock this slot'}
                    >
                      {actionSlotId === slot.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                      ) : isBlocked ? (
                        <>
                          <Unlock className="w-4 h-4 text-[#134e44]" />
                          <span>Unlock</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-rose-600" />
                          <span>Lock</span>
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
