import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { logger } from './logger';

export interface WebSocketEvent<T = unknown> {
  event: string;
  payload: T;
  timestamp: string;
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private wss: WebSocketServer | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(server: http.Server, path: string = '/ws'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected');

      ws.on('message', (message: string) => {
        logger.debug('WebSocket message received', { message: message.toString() });
      });

      ws.on('close', () => {
        logger.debug('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket connection error', { error: error.message });
      });
    });

    logger.info(`WebSocket server initialized on ${path}`);
  }

  broadcast<T = unknown>(event: string, payload: T): void {
    if (!this.wss) return;

    const data = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default WebSocketService;
