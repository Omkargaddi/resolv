import http from 'http';
import { WebSocketService } from '../utils/websocket';

describe('WebSocketService Unit Tests', () => {
  it('should return a singleton instance', () => {
    const instance1 = WebSocketService.getInstance();
    const instance2 = WebSocketService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should not throw when broadcasting without clients', () => {
    const wsService = WebSocketService.getInstance();
    const server = http.createServer();
    wsService.initialize(server, '/test-ws');

    expect(() => {
      wsService.broadcast('testEvent', { hello: 'world' });
    }).not.toThrow();

    server.close();
  });
});
