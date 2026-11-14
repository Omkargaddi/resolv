import React, { useState } from 'react';
import {
  User,
  Shield,
  Calendar,
  Bookmark,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { Slot, Booking } from '../types';
import { useAuth, PRESET_PERSONAS } from '../context/AuthContext';
import SlotSelector from './SlotSelector';
import MyBookingsPanel from './MyBookingsPanel';
import BookingModal from './BookingModal';
import AdminDeck from './AdminDeck';

interface ClientPaneProps {
  personaId: 'user1' | 'user2' | 'admin';
  venueId: string;
  venueName?: string;
  selectedDate: string;
  refreshTrigger: number;
  onDataMutated: () => void;
}

export const ClientPane: React.FC<ClientPaneProps> = ({
  personaId,
  venueId,
  venueName = 'Main Hall',
  selectedDate,
  refreshTrigger,
  onDataMutated,
}) => {
  const { sessions, loginPersona, logoutPersona } = useAuth();
  const session = sessions[personaId];
  const preset = PRESET_PERSONAS[personaId];

  const [activeTab, setActiveTab] = useState<'slots' | 'bookings' | 'admin'>('slots');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<Slot | null>(null);

  const isLoggedIn = !!session.token;
  const isAdmin = preset.role === 'admin';

  return (
    <div className="flex flex-col h-full bg-[#0a0f2c] rounded-2xl border border-[#1c2763] shadow-xl overflow-hidden">
      {/* Pane Persona Header */}
      <div className="p-3.5 bg-[#080c20] border-b border-[#1c2763] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border shadow-sm ${
              isAdmin
                ? 'bg-[#293681]/30 border-[#4274D9]/50 text-[#95CCDD]'
                : personaId === 'user1'
                ? 'bg-[#4274D9]/20 border-[#4274D9]/40 text-[#D0E7E6]'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{preset.name}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-[#293681] text-[#D0E7E6] border border-[#4274D9]/40'
                    : 'bg-[#0f1538] text-[#95CCDD] border border-[#1c2763]'
                }`}
              >
                {preset.role}
              </span>
            </div>
            <div className="text-xs text-[#95CCDD] font-mono">{preset.email}</div>
          </div>
        </div>

        {/* Auth status toggle */}
        <div className="flex items-center gap-2">
          {session.isLoading ? (
            <span className="p-1.5 text-[#95CCDD]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#4274D9]" />
            </span>
          ) : isLoggedIn ? (
            <button
              onClick={() => logoutPersona(personaId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#95CCDD] hover:text-rose-400 hover:bg-[#151e4d] border border-transparent hover:border-rose-500/30 transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => loginPersona(personaId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#4274D9] hover:bg-[#293681] text-white shadow-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth Error Banner if login fails */}
      {session.error && !isLoggedIn && (
        <div className="px-3.5 py-2 bg-rose-500/15 border-b border-rose-500/30 text-xs text-rose-300 font-mono flex items-center justify-between">
          <span className="truncate">{session.error}</span>
          <button
            onClick={() => loginPersona(personaId)}
            className="text-xs font-bold text-rose-400 hover:text-rose-200 underline shrink-0 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Pane Tabs Header */}
      <div className="px-3.5 pt-2 pb-0 bg-[#080c20]/80 border-b border-[#1c2763] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'slots'
                ? 'border-[#4274D9] text-[#D0E7E6]'
                : 'border-transparent text-[#95CCDD] hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Time Slots</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border-b-2 transition ${
                activeTab === 'bookings'
                  ? 'border-[#4274D9] text-[#D0E7E6]'
                  : 'border-transparent text-[#95CCDD] hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>My Bookings</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold border-b-2 transition ${
                activeTab === 'admin'
                  ? 'border-[#4274D9] text-[#D0E7E6]'
                  : 'border-transparent text-[#95CCDD] hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4 text-[#95CCDD]" />
              <span>Queues & Workers</span>
            </button>
          )}
        </div>
      </div>

      {/* Pane Content Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'slots' && (
          <SlotSelector
            venueId={venueId}
            venueName={venueName}
            userRole={preset.role}
            token={session.token}
            selectedDate={selectedDate}
            onSelectSlot={(slot) => setSelectedSlotForBooking(slot)}
            refreshTrigger={refreshTrigger}
            onDataMutated={onDataMutated}
          />
        )}

        {activeTab === 'bookings' && (
          <MyBookingsPanel
            token={session.token}
            userName={preset.name}
            onBookingCancelled={onDataMutated}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDeck token={session.token} onRefreshSlots={onDataMutated} />
        )}
      </div>

      {/* Booking Modal */}
      {selectedSlotForBooking && (
        <BookingModal
          slot={selectedSlotForBooking}
          token={session.token}
          venueName={venueName}
          onClose={() => setSelectedSlotForBooking(null)}
          onSuccess={(_booking: Booking) => {
            onDataMutated();
          }}
        />
      )}
    </div>
  );
};

export default ClientPane;
