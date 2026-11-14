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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#79D1C3]/35 shadow-xs">
        <div className="text-sm font-bold text-slate-800">
          Reservations
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex bg-[#F8FCFB] p-1 rounded-xl border border-slate-200 text-xs">
            {(['all', 'confirmed', 'cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg capitalize text-xs font-bold transition ${
                  statusFilter === filter
                    ? 'bg-[#6892D5] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={fetchBookings}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#F8FCFB] hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition shadow-xs"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 text-[#6892D5] ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700 font-mono">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-mono">
          {error}
        </div>
      )}

      {/* Bookings List */}
      {isLoading && bookings.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2.5 font-mono">
          <RefreshCw className="w-5 h-5 animate-spin text-[#6892D5]" />
          <span>Loading reservations...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2.5 bg-white rounded-2xl border border-dashed border-[#79D1C3]/50 p-6">
          <Search className="w-6 h-6 text-[#6892D5]" />
          <p className="font-bold text-base text-slate-800">No {statusFilter !== 'all' ? statusFilter : ''} bookings found</p>
          <p className="text-xs text-slate-500">Select an available slot above to create a booking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isConfirmed = booking.status === 'confirmed';
            return (
              <div
                key={booking.id}
                className="p-4 rounded-2xl bg-white border border-[#79D1C3]/35 hover:border-[#6892D5]/70 transition-all space-y-3 shadow-xs hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {booking.confirmationCode}
                      </span>
                      <button
                        onClick={() => copyCode(booking.confirmationCode)}
                        className="text-slate-400 hover:text-slate-700 transition p-1"
                        title="Copy code"
                      >
                        {copiedCode === booking.confirmationCode ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          isConfirmed
                            ? 'bg-[#C9FDD7] text-[#134e44] border border-[#79D1C3]/60'
                            : 'bg-rose-100 text-rose-700 border border-rose-300'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3.5 text-xs text-slate-600 mt-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#6892D5]" />
                        {booking.bookingDate}
                      </span>
                      {booking.slot && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#6892D5]" />
                          {new Date(booking.slot.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#6892D5]" />
                        {booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}
                      </span>
                      {booking.totalPrice && (
                        <span className="text-emerald-700 font-mono font-bold text-sm">
                          ${booking.totalPrice}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cancel Button */}
                  {isConfirmed && (
                    <button
                      onClick={() => setCancellingId(cancellingId === booking.id ? null : booking.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>

                {/* Optional Notes */}
                {booking.notes && (
                  <p className="text-xs text-slate-600 bg-[#F8FCFB] p-2.5 rounded-xl border border-slate-200 italic">
                    Note: "{booking.notes}"
                  </p>
                )}

                {/* Cancel Confirmation Prompt */}
                {cancellingId === booking.id && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5 animate-fade-in text-xs">
                    <p className="text-rose-800 font-semibold">
                      Release this reservation and restore slot capacity?
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Cancellation reason (optional)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-rose-400"
                      />
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setCancellingId(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
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
