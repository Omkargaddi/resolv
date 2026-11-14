import React, { useState } from 'react';
import {
  User,
  Shield,
  Calendar,
  Bookmark,
  LogIn,
  LogOut,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Slot, Booking, WebSocketEvent } from '../types';
import { useAuth, PRESET_PERSONAS } from '../context/AuthContext';
import SlotSelector from './SlotSelector';
import MyBookingsPanel from './MyBookingsPanel';
import BookingModal from './BookingModal';
import WebSocketLog from './WebSocketLog';

interface ClientPaneProps {
  personaId: 'user1' | 'user2' | 'admin';
  venueId: string;
  venueName?: string;
  selectedDate: string;
  refreshTrigger: number;
  onDataMutated: () => void;
  events?: WebSocketEvent[];
  onClearEvents?: () => void;
}

export const ClientPane: React.FC<ClientPaneProps> = ({
  personaId,
  venueId,
  venueName = 'Main Hall',
  selectedDate,
  refreshTrigger,
  onDataMutated,
  events = [],
  onClearEvents = () => {},
}) => {
  const { sessions, loginPersona, logoutPersona } = useAuth();
  const session = sessions[personaId];
  const preset = PRESET_PERSONAS[personaId];

  const [activeTab, setActiveTab] = useState<'slots' | 'bookings' | 'admin'>('slots');
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<Slot | null>(null);

  const isLoggedIn = !!session.token;
  const isAdmin = preset.role === 'admin';

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-[#79D1C3]/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Pane Persona Header */}
      <div className="p-4 bg-[#F8FCFB] border-b border-[#79D1C3]/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border shadow-xs ${
              isAdmin
                ? 'bg-[#C9FDD7] border-[#79D1C3] text-[#134e44]'
                : personaId === 'user1'
                ? 'bg-[#6892D5]/15 border-[#6892D5]/40 text-[#244279]'
                : 'bg-[#79D1C3]/20 border-[#79D1C3]/50 text-[#134e44]'
            }`}
          >
            {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-800">{preset.name}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-[#C9FDD7] text-[#134e44] border border-[#79D1C3]/60'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {preset.role}
              </span>
            </div>
          </div>
        </div>

        {/* Auth status toggle */}
        <div className="flex items-center gap-2">
          {session.isLoading ? (
            <span className="p-1.5 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-[#6892D5]" />
            </span>
          ) : isLoggedIn ? (
            <button
              onClick={() => logoutPersona(personaId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => loginPersona(personaId)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#6892D5] hover:bg-[#557ec4] text-white shadow-xs transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth Error Banner if login fails */}
      {session.error && !isLoggedIn && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 font-mono flex items-center justify-between">
          <span className="truncate">{session.error}</span>
          <button
            onClick={() => loginPersona(personaId)}
            className="text-xs font-bold text-rose-700 hover:text-rose-900 underline shrink-0 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Pane Tabs Header */}
      <div className="px-4 pt-2.5 pb-0 bg-white border-b border-[#79D1C3]/25 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'slots'
                ? 'border-[#6892D5] text-[#244279] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Time Slots</span>
          </button>

          {!isAdmin && (
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition ${
                activeTab === 'bookings'
                  ? 'border-[#6892D5] text-[#244279] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>My Bookings</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 transition ${
                activeTab === 'admin'
                  ? 'border-[#6892D5] text-[#244279] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Radio className="w-4 h-4 text-[#79D1C3]" />
              <span>WebSocket Logs</span>
              {events.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-xs font-mono font-bold bg-[#C9FDD7] text-[#134e44]">
                  {events.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pane Content Body */}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto bg-[#F8FCFB]/50 flex flex-col">
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
          <WebSocketLog events={events} onClear={onClearEvents} />
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
