/**
 * WebSocket Message Router
 * Routes incoming messages by 'kind' field to appropriate handlers
 */

import { AuthenticatedWebSocket } from './server.js';
import { ClientMessage, ServerMessage } from './types.js';
import { log } from '../lib/logger.js';

// Handler type definitions
type MessageHandler = (
  ws: AuthenticatedWebSocket,
  message: any
) => Promise<void> | void;

// Handler registry
const handlers = new Map<string, MessageHandler>();

/**
 * Register a message handler for a specific message kind
 */
export function registerHandler(kind: string, handler: MessageHandler): void {
  if (handlers.has(kind)) {
    log.warn('Overwriting existing handler', { kind });
  }
  handlers.set(kind, handler);
  log.info('Registered WebSocket handler', { kind });
}

/**
 * Route incoming message to appropriate handler based on 'kind' field
 */
export async function routeMessage(
  ws: AuthenticatedWebSocket,
  message: ClientMessage
): Promise<void> {
  try {
    // Validate message structure
    if (!message || typeof message !== 'object') {
      sendError(ws, 'Invalid message format: must be JSON object', 'INVALID_MESSAGE');
      return;
    }

    if (!message.kind || typeof message.kind !== 'string') {
      sendError(ws, 'Invalid message: missing or invalid "kind" field', 'MISSING_KIND');
      return;
    }

    const handler = handlers.get(message.kind);

    if (!handler) {
      log.warn('No handler registered for message kind', {
        kind: message.kind,
        userId: ws.userId,
      });
      sendError(
        ws,
        `Unknown message kind: ${message.kind}`,
        'UNKNOWN_MESSAGE_KIND'
      );
      return;
    }

    // Execute handler
    log.info('Routing message', {
      kind: message.kind,
      userId: ws.userId,
      conversationId: (message as any).conversationId,
    });

    await handler(ws, message);
  } catch (error) {
    log.error('Message routing error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: ws.userId,
      kind: message?.kind,
    });

    sendError(
      ws,
      'Internal error processing message',
      'ROUTING_ERROR'
    );
  }
}

/**
 * Send error message to client
 */
function sendError(
  ws: AuthenticatedWebSocket,
  message: string,
  code: string
): void {
  const errorMessage: ServerMessage = {
    kind: 'error',
    error: message,
    code,
  };

  if (ws.readyState === 1) {
    // WebSocket.OPEN
    ws.send(JSON.stringify(errorMessage));
  }
}

/**
 * Send success response to client
 */
export function sendSuccess(
  ws: AuthenticatedWebSocket,
  message: ServerMessage
): void {
  if (ws.readyState === 1) {
    // WebSocket.OPEN
    ws.send(JSON.stringify(message));
  }
}

// ============================================================================
// Built-in Handlers
// ============================================================================

/**
 * Handle ping messages (keep-alive)
 */
async function handlePing(
  ws: AuthenticatedWebSocket,
  message: { kind: 'ping'; timestamp: number }
): Promise<void> {
  const serverTime = Date.now();

  sendSuccess(ws, {
    kind: 'pong',
    timestamp: message.timestamp,
    serverTime,
  });
}

/**
 * Handle cancel messages (abort ongoing operations)
 */
async function handleCancel(
  ws: AuthenticatedWebSocket,
  message: { kind: 'cancel'; jobId: string }
): Promise<void> {
  log.info('Cancel request received', {
    userId: ws.userId,
    jobId: message.jobId,
  });

  // TODO: Implement cancellation logic in Phase 3
  // This will need to track ongoing jobs and signal cancellation

  sendSuccess(ws, {
    kind: 'cancelled',
    jobId: message.jobId,
  });
}

// Register built-in handlers
registerHandler('ping', handlePing);
registerHandler('cancel', handleCancel);

// Register chat handler
import { handleChatMessage } from './handlers/chatHandler';
registerHandler('chat', handleChatMessage);
