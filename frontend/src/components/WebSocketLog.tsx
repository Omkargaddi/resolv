import React, { useState } from 'react';
import { Radio, ChevronUp, ChevronDown, Trash2, Copy, Check, Terminal } from 'lucide-react';
import { WebSocketEvent } from '../types';

interface WebSocketLogProps {
  events: WebSocketEvent[];
  onClear: () => void;
}

export const WebSocketLog: React.FC<WebSocketLogProps> = ({ events, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyEvent = (event: WebSocketEvent, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl transition-all">
      {/* Ticker / Header bar */}
      <div className="px-4 py-2 flex items-center justify-between text-xs font-mono">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition group"
        >
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-200">WebSocket Live Stream</span>
            <span className="text-slate-400">({events.length})</span>
          </div>

          {events.length > 0 && (
            <span className="text-slate-400 truncate max-w-xs sm:max-w-md hidden md:inline">
              Latest: <span className="text-cyan-300">{events[0].event}</span> @{' '}
              {new Date(events[0].timestamp).toLocaleTimeString()}
            </span>
          )}

          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
          )}
        </button>

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="Clear event logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            ws://localhost:4000/ws
          </span>
        </div>
      </div>

      {/* Expanded Log Drawer */}
      {isOpen && (
        <div className="max-h-72 overflow-y-auto px-4 py-2 space-y-2 border-t border-slate-800/80 bg-slate-950 font-mono text-xs">
          {events.length === 0 ? (
            <div className="py-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Terminal className="w-6 h-6 text-slate-600" />
              <p>No WebSocket events received yet.</p>
              <p className="text-[11px] text-slate-600">
                Book a slot, cancel a reservation, or block a slot to watch events broadcast live!
              </p>
            </div>
          ) : (
            events.map((evt, idx) => {
              const isSlotEvent = evt.event === 'slotAvailabilityChanged';
              return (
                <div
                  key={`${evt.timestamp}-${idx}`}
                  className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 overflow-hidden">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        isSlotEvent
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {evt.event}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}.
                      {String(new Date(evt.timestamp).getMilliseconds()).padStart(3, '0')}
                    </span>
                    <div className="text-slate-300 text-xs truncate font-mono">
                      {JSON.stringify(evt.payload)}
                    </div>
                  </div>

                  <button
                    onClick={() => copyEvent(evt, idx)}
                    className="self-end sm:self-center shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                    title="Copy event payload"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default WebSocketLog;
