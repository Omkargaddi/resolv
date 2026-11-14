import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth, PRESET_PERSONAS } from './context/AuthContext';
import Header from './components/Header';
import ClientPane from './components/ClientPane';
import ConcurrencyArena from './components/ConcurrencyArena';
import WebSocketLog from './components/WebSocketLog';
import { wsClient } from './services/websocket';
import { WebSocketEvent, Venue } from './types';
import { getVenuesApi } from './services/api';
import { User, Shield } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activePersonaId, setActivePersonaId } = useAuth();

  const [viewMode, setViewMode] = useState<'split' | 'single' | 'concurrency'>('split');
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>(
    'connecting'
  );
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    '11111111-1111-1111-1111-111111111111'
  );

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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Top Navigation */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        wsStatus={wsStatus}
        eventCount={events.length}
        onRefreshAll={handleDataMutated}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* VIEW 1: MULTI-SPLIT ARENA */}
        {viewMode === 'split' && (
          <div className="space-y-4 animate-fade-in">
            {/* Split View Explanation Banner */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>
                  <strong>Multi-Split Live Synchronization Arena:</strong> Each pane runs an independent
                  authenticated session. When User 1 reserves a slot, User 2's capacity updates in real
                  time via WebSockets without page reload!
                </span>
              </div>
            </div>

            {/* 3-Pane Side-by-Side Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Client A */}
              <div className="h-[750px] flex flex-col">
                <ClientPane
                  personaId="user1"
                  venueId={activeVenue.id}
                  venueName={activeVenue.name}
                  refreshTrigger={refreshTrigger}
                  onDataMutated={handleDataMutated}
                />
              </div>

              {/* Client B */}
              <div className="h-[750px] flex flex-col">
                <ClientPane
                  personaId="user2"
                  venueId={activeVenue.id}
                  venueName={activeVenue.name}
                  refreshTrigger={refreshTrigger}
                  onDataMutated={handleDataMutated}
                />
              </div>

              {/* Admin Deck */}
              <div className="h-[750px] flex flex-col">
                <ClientPane
                  personaId="admin"
                  venueId={activeVenue.id}
                  venueName={activeVenue.name}
                  refreshTrigger={refreshTrigger}
                  onDataMutated={handleDataMutated}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: SINGLE CLIENT FOCUS */}
        {viewMode === 'single' && (
          <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
            {/* Persona Switcher Bar */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 pl-2">Active Persona:</span>
              <div className="flex items-center gap-1.5">
                {(['user1', 'user2', 'admin'] as const).map((pid) => {
                  const p = PRESET_PERSONAS[pid];
                  const isSelected = activePersonaId === pid;
                  return (
                    <button
                      key={pid}
                      onClick={() => setActivePersonaId(pid)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {p.role === 'admin' ? (
                        <Shield className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-[700px]">
              <ClientPane
                personaId={activePersonaId}
                venueId={activeVenue.id}
                venueName={activeVenue.name}
                refreshTrigger={refreshTrigger}
                onDataMutated={handleDataMutated}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: CONCURRENCY & EDGE CASES LAB */}
        {viewMode === 'concurrency' && <ConcurrencyArena />}
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
