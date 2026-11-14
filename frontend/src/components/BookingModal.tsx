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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0a0f2c] border border-[#1c2763] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#1c2763] bg-[#080c20]">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#4274D9]" />
              {confirmedBooking ? 'Booking Confirmed!' : 'Confirm Reservation'}
            </h3>
            <p className="text-xs text-[#95CCDD] mt-0.5">{venueName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#95CCDD] hover:text-white hover:bg-[#151e4d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {confirmedBooking ? (
          /* Confirmation Success State */
          <div className="p-7 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-2xl font-bold text-white">You're All Set!</h4>
              <p className="text-sm text-[#95CCDD]">
                Your reservation has been locked into the system with zero double-booking guarantees.
              </p>
            </div>

            {/* Confirmation Code Box */}
            <div className="p-4.5 rounded-2xl bg-[#080c20] border border-[#1c2763] flex items-center justify-between">
              <div className="text-left">
                <span className="text-xs uppercase tracking-wider text-[#95CCDD] font-mono font-semibold">
                  Confirmation Code
                </span>
                <div className="font-mono text-2xl font-black text-[#4274D9] tracking-wider mt-0.5">
                  {confirmedBooking.confirmationCode}
                </div>
              </div>
              <button
                onClick={() => copyCode(confirmedBooking.confirmationCode)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0f1538] hover:bg-[#151e4d] text-white border border-[#1c2763] transition shadow-sm"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#95CCDD]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Booking Details Grid */}
            <div className="grid grid-cols-2 gap-3.5 text-left text-xs bg-[#080c20]/60 p-4 rounded-2xl border border-[#1c2763] font-mono">
              <div>
                <span className="text-[#95CCDD]">Date:</span>
                <div className="text-white font-semibold text-sm">{slot.date}</div>
              </div>
              <div>
                <span className="text-[#95CCDD]">Guests:</span>
                <div className="text-white font-semibold text-sm">{confirmedBooking.guestCount}</div>
              </div>
              <div>
                <span className="text-[#95CCDD]">Time:</span>
                <div className="text-white font-semibold text-sm">
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div>
                <span className="text-[#95CCDD]">Total Price:</span>
                <div className="text-emerald-400 font-bold text-sm">
                  ${confirmedBooking.totalPrice || totalPrice} {slot.currency}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-bold bg-[#4274D9] hover:bg-[#293681] text-white shadow-lg shadow-[#4274D9]/25 transition"
            >
              Done
            </button>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="font-mono break-all">{error}</div>
              </div>
            )}

            {/* Slot Info Card */}
            <div className="p-4 rounded-2xl bg-[#080c20] border border-[#1c2763] space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-white font-semibold">
                  <Clock className="w-4 h-4 text-[#4274D9]" />
                  {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {slot.remainingCapacity} seats left
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#95CCDD] pt-2 border-t border-[#1c2763]">
                <span>Date: {slot.date}</span>
                <span className="font-bold text-white font-mono text-sm">
                  ${pricePerGuest} / person
                </span>
              </div>
            </div>

            {/* Guest Count Stepper */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#4274D9]" />
                  Party Size (Guests)
                </span>
                <span className="text-xs text-[#95CCDD] font-normal">
                  Max: {slot.remainingCapacity}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
                  disabled={guestCount <= 1}
                  className="w-11 h-11 rounded-2xl bg-[#0f1538] hover:bg-[#151e4d] disabled:opacity-40 text-white font-bold text-xl flex items-center justify-center border border-[#1c2763] transition"
                >
                  -
                </button>
                <div className="flex-1 py-2.5 text-center font-mono font-bold text-xl bg-[#080c20] border border-[#1c2763] rounded-2xl text-white">
                  {guestCount}
                </div>
                <button
                  type="button"
                  onClick={() => setGuestCount((c) => Math.min(slot.remainingCapacity, c + 1))}
                  disabled={guestCount >= slot.remainingCapacity}
                  className="w-11 h-11 rounded-2xl bg-[#0f1538] hover:bg-[#151e4d] disabled:opacity-40 text-white font-bold text-xl flex items-center justify-center border border-[#1c2763] transition"
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white">
                Special Requests & Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Window booth preferred, anniversary"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2.5 rounded-2xl text-xs bg-[#080c20] border border-[#1c2763] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#4274D9] transition"
              />
            </div>

            {/* Summary & Price Total */}
            <div className="p-3.5 rounded-2xl bg-[#293681]/30 border border-[#4274D9]/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#D0E7E6]">
                <CreditCard className="w-4 h-4 text-[#4274D9]" />
                <span className="font-semibold">Total Amount:</span>
              </div>
              <div className="text-lg font-bold text-[#D0E7E6] font-mono">
                ${totalPrice.toFixed(2)} {slot.currency}
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-3 rounded-2xl text-xs font-semibold bg-[#0f1538] hover:bg-[#151e4d] text-[#D0E7E6] border border-[#1c2763] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || slot.remainingCapacity < guestCount}
                className="w-2/3 py-3 rounded-2xl text-xs font-bold bg-[#4274D9] hover:bg-[#293681] disabled:opacity-50 text-white shadow-lg shadow-[#4274D9]/25 transition flex items-center justify-center gap-2"
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
