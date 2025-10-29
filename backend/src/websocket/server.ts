/**
 * WebSocket Server Setup
 * Handles real-time bidirectional communication for streaming responses
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { routeMessage } from './router';
import { log } from '../lib/logger';
import { ServerMessage } from './types';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userEmail?: string;
  isAlive?: boolean;
  lastMessageTime?: number;
  messageCount?: number;
}

export class WebSocketServerManager {
  private wss: WebSocketServer | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds

  /**
   * Initialize WebSocket server on existing HTTP server
   */
  public initialize(httpServer: HTTPServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests
    httpServer.on('upgrade', async (request: IncomingMessage, socket, head) => {
      try {
        // Authenticate connection
        const user = await authMiddleware(request);

        if (!user) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Upgrade to WebSocket
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedWebSocket;
          authWs.userId = user.id;
          authWs.userEmail = user.email;
          authWs.isAlive = true;
          authWs.lastMessageTime = Date.now();
          authWs.messageCount = 0;

          this.wss!.emit('connection', authWs, request);
        });
      } catch (error) {
        log.error('WebSocket upgrade failed', {
          error: error instanceof Error ? error.message : String(error),
          path: request.url,
        });
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    // Handle new connections
    this.wss.on('connection', (ws: AuthenticatedWebSocket) => {
      log.info('WebSocket connection established', {
        userId: ws.userId,
        email: ws.userEmail,
      });

      // Send connection success message
      this.sendMessage(ws, {
        kind: 'connection',
        connectionId: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: ws.userId!,
      });

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          // Apply rate limiting
          const rateLimitError = rateLimitMiddleware(ws);
          if (rateLimitError) {
            this.sendMessage(ws, {
              kind: 'error',
              error: rateLimitError.message,
              code: 'RATE_LIMIT_EXCEEDED',
            });
            return;
          }

          // Parse and route message
          const message = JSON.parse(data.toString());
          await routeMessage(ws, message);
        } catch (error) {
          log.error('WebSocket message handling failed', {
            userId: ws.userId,
            error: error instanceof Error ? error.message : String(error),
          });

          this.sendMessage(ws, {
            kind: 'error',
            error: 'Failed to process message',
            code: 'MESSAGE_PROCESSING_ERROR',
          });
        }
      });

      // Handle pong responses (for keep-alive)
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle connection close
      ws.on('close', () => {
        log.info('WebSocket connection closed', {
          userId: ws.userId,
          email: ws.userEmail,
        });
      });

      // Handle errors
      ws.on('error', (error) => {
        log.error('WebSocket error', {
          userId: ws.userId,
          error: error.message,
        });
      });
    });

    // Start keep-alive ping interval
    this.startPingInterval();

    log.info('WebSocket server initialized');
  }

  /**
   * Send message to client
   */
  public sendMessage(ws: AuthenticatedWebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients for a user
   */
  public broadcastToUser(userId: string, message: ServerMessage): void {
    if (!this.wss) return;

    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (authClient.userId === userId && authClient.readyState === WebSocket.OPEN) {
        authClient.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Start ping interval to detect dead connections
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;

        if (authWs.isAlive === false) {
          log.warn('Terminating dead WebSocket connection', {
            userId: authWs.userId,
          });
          return authWs.terminate();
        }

        authWs.isAlive = false;
        authWs.ping();
      });
    }, this.PING_INTERVAL);
  }

  /**
   * Gracefully shutdown WebSocket server
   */
  public async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.wss) {
      // Close all connections
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        this.sendMessage(authWs, {
          kind: 'error',
          error: 'Server shutdown',
          code: 'SERVER_SHUTDOWN',
        });
        ws.close(1001, 'Server shutdown');
      });

      // Close server
      return new Promise((resolve) => {
        this.wss!.close(() => {
          log.info('WebSocket server closed');
          resolve();
        });
      });
    }
  }

  /**
   * Get current connection count
   */
  public getConnectionCount(): number {
    return this.wss?.clients.size || 0;
  }

  /**
   * Get connection count for specific user
   */
  public getUserConnectionCount(userId: string): number {
    if (!this.wss) return 0;

    let count = 0;
    this.wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (authClient.userId === userId) {
        count++;
      }
    });
    return count;
  }
}

// Singleton instance
export const wsManager = new WebSocketServerManager();
