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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Reservations for {userName}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300">
              {bookings.length}
            </span>
          </h4>
          <p className="text-[11px] text-slate-400">
            Real-time status tracking & instant seat reclamation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            {(['all', 'confirmed', 'cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded capitalize text-xs transition ${
                  statusFilter === filter
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={fetchBookings}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* Bookings List */}
      {isLoading && bookings.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2 font-mono">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span>Loading reservations...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
          <Search className="w-6 h-6 text-slate-600" />
          <p className="font-semibold text-slate-400">No {statusFilter !== 'all' ? statusFilter : ''} bookings found</p>
          <p className="text-[11px] text-slate-600">Select an available slot above to create a booking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isConfirmed = booking.status === 'confirmed';
            return (
              <div
                key={booking.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">
                        {booking.confirmationCode}
                      </span>
                      <button
                        onClick={() => copyCode(booking.confirmationCode)}
                        className="text-slate-500 hover:text-slate-300 transition"
                        title="Copy code"
                      >
                        {copiedCode === booking.confirmationCode ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {booking.bookingDate}
                      </span>
                      {booking.slot && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {new Date(booking.slot.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        {booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}
                      </span>
                      {booking.totalPrice && (
                        <span className="text-emerald-400 font-mono font-medium">
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
