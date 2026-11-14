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
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#080c20]/95 backdrop-blur-md border-t border-[#1c2763] shadow-xl transition-all">
      {/* Ticker / Header bar */}
      <div className="px-4 py-2.5 flex items-center justify-between text-xs font-mono">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 text-[#D0E7E6] hover:text-white transition group"
        >
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#0f1538] border border-[#1c2763]">
            <Radio className="w-3.5 h-3.5 text-[#4274D9] animate-pulse" />
            <span className="font-semibold text-white text-xs">WebSocket Live Stream</span>
            <span className="text-[#95CCDD] text-xs font-bold">({events.length})</span>
          </div>

          {events.length > 0 && (
            <span className="text-[#95CCDD] truncate max-w-xs sm:max-w-md hidden md:inline text-xs">
              Latest: <span className="text-[#D0E7E6] font-semibold">{events[0].event}</span> @{' '}
              {new Date(events[0].timestamp).toLocaleTimeString()}
            </span>
          )}

          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-[#95CCDD] group-hover:text-white" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#95CCDD] group-hover:text-white" />
          )}
        </button>

        <div className="flex items-center gap-2.5">
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0f1538] hover:bg-[#151e4d] text-[#D0E7E6] hover:text-white border border-[#1c2763] transition text-xs font-medium"
              title="Clear event logs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear</span>
            </button>
          )}
          <span className="text-xs text-[#95CCDD]/70 hidden sm:inline font-mono">
            ws://localhost:4000/ws
          </span>
        </div>
      </div>

      {/* Expanded Log Drawer */}
      {isOpen && (
        <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2 border-t border-[#1c2763] bg-[#080c20] font-mono text-xs">
          {events.length === 0 ? (
            <div className="py-6 text-center text-[#95CCDD] flex flex-col items-center justify-center gap-2">
              <Terminal className="w-5 h-5 text-[#4274D9]" />
              <p className="text-xs font-semibold text-white">No WebSocket events received yet.</p>
              <p className="text-xs text-[#95CCDD]">
                Book a slot or block a slot to watch events broadcast live across sessions.
              </p>
            </div>
          ) : (
            events.map((evt, idx) => {
              const isSlotEvent = evt.event === 'slotAvailabilityChanged';
              return (
                <div
                  key={`${evt.timestamp}-${idx}`}
                  className="p-2.5 rounded-xl bg-[#0f1538] border border-[#1c2763] hover:border-[#4274D9]/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 overflow-hidden">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold shrink-0 ${
                        isSlotEvent
                          ? 'bg-[#293681] text-[#D0E7E6] border border-[#4274D9]/40'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {evt.event}
                    </span>
                    <span className="text-xs text-[#95CCDD] shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString()}.
                      {String(new Date(evt.timestamp).getMilliseconds()).padStart(3, '0')}
                    </span>
                    <div className="text-slate-200 text-xs truncate font-mono">
                      {JSON.stringify(evt.payload)}
                    </div>
                  </div>

                  <button
                    onClick={() => copyEvent(evt, idx)}
                    className="self-end sm:self-center text-[#95CCDD] hover:text-white transition shrink-0 p-1.5 rounded-lg hover:bg-[#151e4d]"
                    title="Copy event payload"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
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
