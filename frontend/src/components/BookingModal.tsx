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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="h-200 relative w-full max-w-lg bg-white border border-[#79D1C3]/40 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#79D1C3]/30 bg-[#F8FCFB]">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#6892D5]" />
              {confirmedBooking ? 'Booking Confirmed!' : 'Confirm Reservation'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* Confirmation Success State */
          <div className="p-7 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#C9FDD7] border border-[#79D1C3] flex items-center justify-center text-[#134e44] shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-2xl font-bold text-slate-900">You're All Set!</h4>
              <p className="text-sm text-slate-600">
                Your reservation has been locked into the system with zero double-booking guarantees.
              </p>
            </div>

            {/* Confirmation Code Box */}
            <div className="p-4.5 rounded-2xl bg-[#F8FCFB] border border-[#79D1C3]/40 flex items-center justify-between">
              <div className="text-left">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-mono font-bold">
                  Confirmation Code
                </span>
                <div className="font-mono text-2xl font-black text-[#6892D5] tracking-wider mt-0.5">
                  {confirmedBooking.confirmationCode}
                </div>
              </div>
              <button
                onClick={() => copyCode(confirmedBooking.confirmationCode)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-xs"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Booking Details Grid */}
            <div className="grid grid-cols-2 gap-3.5 text-left text-xs bg-[#F8FCFB] p-4 rounded-2xl border border-slate-200 font-mono">
              <div>
                <span className="text-slate-500">Date:</span>
                <div className="text-slate-900 font-bold text-sm">{slot.date}</div>
              </div>
              <div>
                <span className="text-slate-500">Guests:</span>
                <div className="text-slate-900 font-bold text-sm">{confirmedBooking.guestCount}</div>
              </div>
              <div>
                <span className="text-slate-500">Time:</span>
                <div className="text-slate-900 font-bold text-sm">
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Total Price:</span>
                <div className="text-emerald-700 font-bold text-sm">
                  ${confirmedBooking.totalPrice || totalPrice} {slot.currency}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-base font-bold bg-[#6892D5] hover:bg-[#557ec4] text-white shadow-md shadow-[#6892D5]/25 transition"
            >
              Done
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="font-mono break-all">{error}</div>
              </div>
            )}

            {/* Slot Info Card */}
            <div className="p-4 rounded-2xl bg-[#F8FCFB] border border-[#79D1C3]/35 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-800 font-bold">
                  <Clock className="w-4 h-4 text-[#6892D5]" />
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#C9FDD7] text-[#134e44] border border-[#79D1C3]/60">
                  {slot.remainingCapacity} seats left
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200 font-medium">
                <span>Date: {slot.date}</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  ${pricePerGuest} / person
                </span>
              </div>
            </div>

            {/* Guest Count Stepper */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#6892D5]" />
                  Party Size (Guests)
                </span>
                <span className="text-xs text-slate-500 font-normal">
                  Max: {slot.remainingCapacity}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                  disabled={guestCount <= 1}
                  className="w-12 h-12 rounded-2xl bg-[#F8FCFB] hover:bg-[#C9FDD7]/30 disabled:opacity-40 text-slate-800 font-bold text-2xl flex items-center justify-center border border-slate-300 transition"
                >
                  -
                </button>
                <div className="flex-1 py-2.5 text-center font-mono font-bold text-2xl bg-white border border-slate-300 rounded-2xl text-slate-900">
                  {guestCount}
                </div>
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.min(slot.remainingCapacity, c + 1))}
                  disabled={guestCount >= slot.remainingCapacity}
                  className="w-12 h-12 rounded-2xl bg-[#F8FCFB] hover:bg-[#C9FDD7]/30 disabled:opacity-40 text-slate-800 font-bold text-2xl flex items-center justify-center border border-slate-300 transition"
                >
                  +
                </button>
              </div>
            </div>


            {/* Summary & Price Total */}
            <div className="p-3.5 rounded-2xl bg-[#C9FDD7]/40 border border-[#79D1C3]/60 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-slate-800">
                <CreditCard className="w-4 h-4 text-[#6892D5]" />
                <span className="font-bold">Total Amount:</span>
              </div>
              <div className="text-xl font-bold text-[#134e44] font-mono">
                ${totalPrice.toFixed(2)} {slot.currency}
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center ">
              
              <button
                type="submit"
                disabled={isSubmitting || slot.remainingCapacity < guestCount}
                className="w-full py-3 rounded-2xl text-sm font-bold bg-[#6892D5] hover:bg-[#557ec4] disabled:opacity-50 text-white shadow-md shadow-[#6892D5]/25 transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
