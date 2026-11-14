import { WebSocketEvent } from '../types';

type EventListener = (event: WebSocketEvent) => void;
type StatusListener = (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private eventListeners: Set<EventListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private reconnectTimeout: number | null = null;
  private status: 'connected' | 'connecting' | 'disconnected' | 'error' = 'disconnected';
  private eventHistory: WebSocketEvent[] = [];
  private readonly maxHistory = 100;

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    // Auto-detect host: if dev server at localhost:3000, Vite proxies /ws to localhost:4000/ws
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        if (this.reconnectTimeout) {
          window.clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (messageEvent) => {
        try {
          const parsed = JSON.parse(messageEvent.data) as WebSocketEvent;
          this.addEventToHistory(parsed);
          this.notifyEventListeners(parsed);
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        this.setStatus('error');
      };
    } catch (err) {
      console.error('[WebSocket] Init failed:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private setStatus(status: 'connected' | 'connecting' | 'disconnected' | 'error'): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  public getStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' {
    return this.status;
  }

  public getEventHistory(): WebSocketEvent[] {
    return [...this.eventHistory];
  }

  public clearEventHistory(): void {
    this.eventHistory = [];
  }

  private addEventToHistory(event: WebSocketEvent): void {
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.pop();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 2500);
  }

  public onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private notifyEventListeners(event: WebSocketEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error('[WebSocket] Error in event listener:', e);
      }
    });
  }

  public close(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
