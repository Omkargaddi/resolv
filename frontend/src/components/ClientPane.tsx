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
  refreshTrigger: number;
  onDataMutated: () => void;
}

export const ClientPane: React.FC<ClientPaneProps> = ({
  personaId,
  venueId,
  venueName = 'Main Hall',
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
    <div className="flex flex-col h-full bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Pane Persona Header */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${preset.avatarColor} flex items-center justify-center text-white font-bold text-xs shadow-md`}
          >
            {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-white tracking-tight">{preset.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                }`}
              >
                {preset.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{preset.email}</div>
          </div>
        </div>

        {/* Auth status toggle */}
        <div className="flex items-center gap-1.5">
          {session.isLoading ? (
            <span className="p-1.5 text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            </span>
          ) : isLoggedIn ? (
            <button
              onClick={() => logoutPersona(personaId)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => loginPersona(personaId)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Pane Tabs Header */}
      <div className="px-3 pt-2 pb-0 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'slots'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Time Slots</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'bookings'
                  ? 'border-indigo-500 text-indigo-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>My Bookings</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                activeTab === 'admin'
                  ? 'border-purple-500 text-purple-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Queues & Health</span>
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
            onSelectSlot={(slot) => setSelectedSlotForBooking(slot)}
            refreshTrigger={refreshTrigger}
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
