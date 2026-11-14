import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import ClientPane from './components/ClientPane';
import WebSocketLog from './components/WebSocketLog';
import { wsClient } from './services/websocket';
import { WebSocketEvent, Venue } from './types';
import { getVenuesApi } from './services/api';
import { Radio, CalendarDays } from 'lucide-react';

const AppContent: React.FC = () => {
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>(
    'connecting'
  );
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    '11111111-1111-1111-1111-111111111111'
  );

  // Generate 7 upcoming date options starting from base date
  const today = new Date('2026-11-14');
  const dateOptions = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const [selectedDate, setSelectedDate] = useState<string>(dateOptions[0]);

  // Trigger data reload across panes
  const handleDataMutated = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Subscribe to WebSocket events and status
  useEffect(() => {
    const unsubStatus = wsClient.onStatus((status) => {
      setWsStatus(status);
    });

    const unsubEvent = wsClient.onEvent((event) => {
      setEvents((prev) => [event, ...prev.slice(0, 99)]);
      // When slot availability or booking changes, update data
      setRefreshTrigger((prev) => prev + 1);
    });

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, []);

  // Fetch Venues on initial load
  useEffect(() => {
    getVenuesApi()
      .then((data) => {
        if (data && data.length > 0) {
          setVenues(data);
          setSelectedVenueId(data[0].id);
        }
      })
      .catch((err) => console.error('Failed to load venues:', err));
  }, []);

  const activeVenue = venues.find((v) => v.id === selectedVenueId) || {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Main Hall',
    address: '100 Reservation Way, City Center',
    timezone: 'UTC',
    capacity: 100,
    isActive: true,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c20] text-slate-100 font-sans pb-16 antialiased">
      {/* Top Navigation */}
      <Header
        wsStatus={wsStatus}
        eventCount={events.length}
        onRefreshAll={handleDataMutated}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Universal Single Day Picker (Synchronizes dates across all 3 client panes) */}
        <div className="bg-[#0a0f2c] p-4 rounded-2xl border border-[#1c2763] shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-[#293681]/40 border border-[#4274D9]/40 flex items-center justify-center text-[#95CCDD] shrink-0">
              <CalendarDays className="w-5 h-5 text-[#4274D9]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Day Selector</span>
              </div>
            </div>
          </div>

          {/* Date Options Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {dateOptions.map((dateStr, idx) => {
              const dateObj = new Date(dateStr + 'T00:00:00');
              const isSelected = dateStr === selectedDate;
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex flex-col items-center px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 border ${
                    isSelected
                      ? 'bg-[#4274D9] text-white border-[#4274D9] shadow-md shadow-[#4274D9]/30 font-bold scale-105'
                      : 'bg-[#0f1538] hover:bg-[#151e4d] text-[#D0E7E6] hover:text-white border-[#1c2763]'
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-bold opacity-80">
                    {idx === 0 ? 'Today' : dayName}
                  </span>
                  <span className="font-mono text-sm mt-0.5">{monthDay}</span>
                </button>
              );
            })}
          </div>
        </div>

      

        {/* 3-Pane Side-by-Side Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {/* Client 1: User 1 (John Doe) */}
          <div className="min-h-[760px] flex flex-col">
            <ClientPane
              personaId="user1"
              venueId={activeVenue.id}
              venueName={activeVenue.name}
              selectedDate={selectedDate}
              refreshTrigger={refreshTrigger}
              onDataMutated={handleDataMutated}
            />
          </div>

          {/* Client 2: User 2 (Alice Smith) */}
          <div className="min-h-[760px] flex flex-col">
            <ClientPane
              personaId="user2"
              venueId={activeVenue.id}
              venueName={activeVenue.name}
              selectedDate={selectedDate}
              refreshTrigger={refreshTrigger}
              onDataMutated={handleDataMutated}
            />
          </div>

          {/* Client 3: System Admin */}
          <div className="min-h-[760px] flex flex-col">
            <ClientPane
              personaId="admin"
              venueId={activeVenue.id}
              venueName={activeVenue.name}
              selectedDate={selectedDate}
              refreshTrigger={refreshTrigger}
              onDataMutated={handleDataMutated}
            />
          </div>
        </div>
      </main>

      {/* Floating Real-Time WebSocket Log Drawer */}
      <WebSocketLog events={events} onClear={() => setEvents([])} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
