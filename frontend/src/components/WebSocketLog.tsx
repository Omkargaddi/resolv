import React, { useState } from 'react';
import { Radio, Trash2, Copy, Check, Terminal, Activity } from 'lucide-react';
import { WebSocketEvent } from '../types';

interface WebSocketLogProps {
  events: WebSocketEvent[];
  onClear: () => void;
}

export const WebSocketLog: React.FC<WebSocketLogProps> = ({ events, onClear }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyEvent = (event: WebSocketEvent, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#79D1C3]/40 shadow-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#C9FDD7]/50 border border-[#79D1C3]/60 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-[#1b5e52] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">WebSocket Live Feed</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-[#C9FDD7] text-[#164e43] border border-[#79D1C3]/50">
                {events.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono hidden sm:block">
              ws://localhost:4000/ws
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FCFB] hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition text-xs font-semibold shadow-xs"
              title="Clear event logs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Events Log List */}
      <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-dashed border-[#79D1C3]/50 p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#C9FDD7]/40 border border-[#79D1C3]/40 flex items-center justify-center text-[#1b5e52]">
              <Activity className="w-6 h-6 text-[#79D1C3]" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No events broadcasted yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Reserve a slot, cancel a booking, or toggle Lock / Unlock to inspect live real-time WebSocket payloads.
              </p>
            </div>
          </div>
        ) : (
          events.map((evt, idx) => {
            const isSlotEvent = evt.event === 'slotAvailabilityChanged';
            return (
              <div
                key={`${evt.timestamp}-${idx}`}
                className="p-3.5 rounded-2xl bg-white border border-[#79D1C3]/35 hover:border-[#6892D5]/70 transition-all shadow-xs flex flex-col gap-2 shrink-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wide border ${
                        isSlotEvent
                          ? 'bg-[#C9FDD7] text-[#164e43] border-[#79D1C3]/60'
                          : 'bg-[#6892D5]/15 text-[#244279] border-[#6892D5]/40'
                      }`}
                    >
                      {evt.event}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}.
                      {String(new Date(evt.timestamp).getMilliseconds()).padStart(3, '0')}
                    </span>
                  </div>

                  <button
                    onClick={() => copyEvent(evt, idx)}
                    className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-lg hover:bg-[#F8FCFB] border border-transparent hover:border-slate-200"
                    title="Copy event JSON payload"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-[#F8FCFB] border border-[#79D1C3]/20 text-xs font-mono text-slate-700 max-h-36 overflow-y-auto break-all">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(evt.payload, null, 2)}</pre>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WebSocketLog;
