import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  CreditCard,
} from 'lucide-react';
import { Slot, Booking } from '../types';
import { createBookingApi, extractApiError } from '../services/api';

interface BookingModalProps {
  slot: Slot;
  token: string | null;
  venueName?: string;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  slot,
  token,
  venueName = 'Main Hall',
  onClose,
  onSuccess,
}) => {
  const [guestCount, setGuestCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const pricePerGuest = slot.price ? Number(slot.price) : 0;
  const totalPrice = pricePerGuest * guestCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('You must be logged in to book a slot.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const booking = await createBookingApi(token, {
        slotId: slot.id,
        venueId: slot.venueId,
        guestCount,
        notes: notes.trim() || undefined,
      });

      setConfirmedBooking(booking);
      onSuccess(booking);
    } catch (err) {
      const { message, code } = extractApiError(err);
      setError(`[${code || 'ERROR'}] ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              {confirmedBooking ? 'Booking Confirmed!' : 'Confirm Reservation'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{venueName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* Confirmation Success State */
          <div className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xl font-bold text-white">You're All Set!</h4>
              <p className="text-xs text-slate-400">
                Your reservation has been locked into the system with zero double-booking guarantees.
              </p>
            </div>

            {/* Confirmation Code Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                  Confirmation Code
                </span>
                <div className="font-mono text-xl font-black text-indigo-400 tracking-wider">
                  {confirmedBooking.confirmationCode}
                </div>
              </div>
              <button
                onClick={() => copyCode(confirmedBooking.confirmationCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Booking Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-left text-xs bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 font-mono">
              <div>
                <span className="text-slate-500">Date:</span>
                <div className="text-slate-200 font-semibold">{slot.date}</div>
              </div>
              <div>
                <span className="text-slate-500">Guests:</span>
                <div className="text-slate-200 font-semibold">{confirmedBooking.guestCount}</div>
              </div>
              <div>
                <span className="text-slate-500">Time:</span>
                <div className="text-slate-200 font-semibold">
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Total Price:</span>
                <div className="text-emerald-400 font-semibold">
                  ${confirmedBooking.totalPrice || totalPrice} {slot.currency}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
            >
              Done
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="font-mono break-all">{error}</div>
              </div>
            )}

            {/* Slot Info Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {slot.remainingCapacity} seats available
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                <span>Date: {slot.date}</span>
                <span className="font-semibold text-slate-200">
                  ${pricePerGuest} / person
                </span>
              </div>
            </div>

            {/* Guest Count Stepper */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Party Size (Guests)
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Max: {slot.remainingCapacity}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                  disabled={guestCount <= 1}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-lg flex items-center justify-center border border-slate-700 transition"
                >
                  -
                </button>
                <div className="flex-1 py-2 text-center font-mono font-bold text-lg bg-slate-950 border border-slate-800 rounded-xl text-white">
                  {guestCount}
                </div>
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.min(slot.remainingCapacity, c + 1))}
                  disabled={guestCount >= slot.remainingCapacity}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-lg flex items-center justify-center border border-slate-700 transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Special Requests & Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Window booth preferred, anniversary"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
                className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Summary & Price Total */}
            <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-indigo-300">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span>Total Amount:</span>
              </div>
              <div className="text-base font-bold text-indigo-400 font-mono">
                ${totalPrice.toFixed(2)} {slot.currency}
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || slot.remainingCapacity < guestCount}
                className="w-2/3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Acquiring Lock & Reserving...
                  </span>
                ) : (
                  <span>Confirm Reservation</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
