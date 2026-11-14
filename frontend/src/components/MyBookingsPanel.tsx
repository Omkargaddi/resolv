import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Users,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Booking } from '../types';
import { getMyBookingsApi, cancelBookingApi, extractApiError } from '../services/api';

interface MyBookingsPanelProps {
  token: string | null;
  userName: string;
  onBookingCancelled?: () => void;
}

export const MyBookingsPanel: React.FC<MyBookingsPanelProps> = ({
  token,
  userName,
  onBookingCancelled,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Schedule change');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getMyBookingsApi(
        token,
        statusFilter === 'all' ? undefined : statusFilter,
        50,
        0
      );
      setBookings(res.data);
    } catch (err) {
      const { message } = extractApiError(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!token) return;
    setActionError(null);
    try {
      await cancelBookingApi(token, bookingId, cancelReason);
      setCancellingId(null);
      fetchBookings();
      if (onBookingCancelled) onBookingCancelled();
    } catch (err) {
      const { message, code } = extractApiError(err);
      setActionError(`[${code || 'ERROR'}] ${message}`);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#080c20] p-4 rounded-2xl border border-[#1c2763]">

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex bg-[#0f1538] p-1 rounded-xl border border-[#1c2763] text-xs">
            {(['all', 'confirmed', 'cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg capitalize text-xs font-semibold transition ${
                  statusFilter === filter
                    ? 'bg-[#4274D9] text-white shadow-sm'
                    : 'text-[#95CCDD] hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={fetchBookings}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#0f1538] hover:bg-[#151e4d] text-[#D0E7E6] hover:text-white border border-[#1c2763] transition shadow-sm"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 text-[#4274D9] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* Bookings List */}
      {isLoading && bookings.length === 0 ? (
        <div className="py-16 text-center text-[#95CCDD] text-sm flex flex-col items-center justify-center gap-2.5 font-mono">
          <RefreshCw className="w-5 h-5 animate-spin text-[#4274D9]" />
          <span>Loading reservations...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-16 text-center text-[#95CCDD] text-sm flex flex-col items-center justify-center gap-2.5 bg-[#080c20]/60 rounded-2xl border border-dashed border-[#1c2763]">
          <Search className="w-6 h-6 text-[#4274D9]" />
          <p className="font-semibold text-white">No {statusFilter !== 'all' ? statusFilter : ''} bookings found</p>
          <p className="text-xs text-[#95CCDD]">Select an available slot above to create a booking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isConfirmed = booking.status === 'confirmed';
            return (
              <div
                key={booking.id}
                className="p-4 rounded-2xl bg-[#0f1538] border border-[#1c2763] hover:border-[#4274D9]/50 transition space-y-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#D0E7E6]">
                        {booking.confirmationCode}
                      </span>
                      <button
                        onClick={() => copyCode(booking.confirmationCode)}
                        className="text-[#95CCDD] hover:text-white transition p-1"
                        title="Copy code"
                      >
                        {copiedCode === booking.confirmationCode ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3.5 text-xs text-[#95CCDD] mt-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#4274D9]" />
                        {booking.bookingDate}
                      </span>
                      {booking.slot && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#4274D9]" />
                          {new Date(booking.slot.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#4274D9]" />
                        {booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}
                      </span>
                      {booking.totalPrice && (
                        <span className="text-emerald-400 font-mono font-bold text-sm">
                          ${booking.totalPrice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cancel Button */}
                  {isConfirmed && (
                    <button
                      onClick={() => setCancellingId(cancellingId === booking.id ? null : booking.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>

                {/* Optional Notes */}
                {booking.notes && (
                  <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/60 italic">
                    Note: "{booking.notes}"
                  </p>
                )}

                {/* Cancel Confirmation Prompt */}
                {cancellingId === booking.id && (
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-2 animate-fade-in text-xs">
                    <p className="text-rose-300 font-medium">
                      Release this reservation and restore slot capacity?
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Cancellation reason (optional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setCancellingId(null)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBookingsPanel;
