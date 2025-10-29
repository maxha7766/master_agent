# WebSocket Protocol: Personal AI Assistant

**Version**: 1.0.0
**Date**: 2025-10-27
**Feature**: 001-personal-ai-assistant

## Overview

This document defines the WebSocket protocol for real-time communication between the frontend and backend, including chat messages, streaming responses, progress updates, and citations.

## Connection

### Endpoint

```
ws://localhost:3001/ws          # Local development
wss://api.example.com/ws        # Production (Railway)
```

### Authentication

Authentication is performed during the WebSocket handshake using a JWT token:

```typescript
// Client connection
const token = getAccessToken(); // From Supabase Auth
const ws = new WebSocket('ws://localhost:3001/ws', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Server Behavior**:
- If token is valid: Connection established
- If token is invalid/missing: Connection closed with code 4001 (Unauthorized)

### Rate Limiting

- **Connection limit**: 5 concurrent connections per user
- **Message rate**: 10 messages per second per connection
- **Violation**: Connection closed with code 4029 (Too Many Requests)

---

## Message Format

All messages are JSON-encoded with a `kind` field for discrimination.

### TypeScript Types

```typescript
// Client → Server messages
type ClientMessage =
  | ChatMessage
  | CancelMessage
  | PingMessage;

// Server → Client messages
type ServerMessage =
  | StreamStartMessage
  | StreamChunkMessage
  | StreamEndMessage
  | ProgressMessage
  | CitationMessage
  | ErrorMessage
  | PongMessage;
```

---

## Client → Server Messages

### 1. Chat Message

**Purpose**: Send a user message to the assistant

**Format**:
```typescript
interface ChatMessage {
  kind: 'chat';
  conversationId: string;  // UUID
  content: string;
}
```

**Example**:
```json
{
  "kind": "chat",
  "conversationId": "123e4567-e89b-12d3-a456-426614174000",
  "content": "What did the Q3 report say about revenue?"
}
```

**Validation**:
- `conversationId`: Must be valid UUID owned by authenticated user
- `content`: Cannot be empty, max length 10,000 characters

**Response Flow**:
1. `StreamStartMessage` (agent selected)
2. Multiple `StreamChunkMessage` (token streaming)
3. Optional `CitationMessage` (if RAG/Research used)
4. `StreamEndMessage` (metadata)

---

### 2. Cancel Message

**Purpose**: Cancel a running research job or long-running operation

**Format**:
```typescript
interface CancelMessage {
  kind: 'cancel';
  jobId: string;  // UUID of research report or operation
}
```

**Example**:
```json
{
  "kind": "cancel",
  "jobId": "789e4567-e89b-12d3-a456-426614174999"
}
```

**Response**:
- Research job status updated to 'cancelled'
- `ErrorMessage` sent with code 'CANCELLED'

---

### 3. Ping Message

**Purpose**: Keep connection alive and measure latency

**Format**:
```typescript
interface PingMessage {
  kind: 'ping';
  timestamp: number;  // Client timestamp in milliseconds
}
```

**Example**:
```json
{
  "kind": "ping",
  "timestamp": 1699564800000
}
```

**Response**:
- `PongMessage` echoing the timestamp

---

## Server → Client Messages

### 1. Stream Start Message

**Purpose**: Indicate start of streaming response and which agent is handling the request

**Format**:
```typescript
interface StreamStartMessage {
  kind: 'stream_start';
  messageId: string;  // UUID of the assistant message being created
  conversationId: string;
  agent: 'master' | 'rag' | 'sql' | 'research';
  model: string;  // e.g., 'claude-sonnet-4.5'
}
```

**Example**:
```json
{
  "kind": "stream_start",
  "messageId": "456e7890-e89b-12d3-a456-426614174111",
  "conversationId": "123e4567-e89b-12d3-a456-426614174000",
  "agent": "rag",
  "model": "claude-sonnet-4.5"
}
```

**Client Behavior**:
- Create new message in UI with empty content
- Show typing indicator
- Display agent indicator (optional, for debugging)

---

### 2. Stream Chunk Message

**Purpose**: Deliver incremental token chunks from LLM streaming

**Format**:
```typescript
interface StreamChunkMessage {
  kind: 'stream_chunk';
  messageId: string;  // Same as StreamStartMessage
  chunk: string;
}
```

**Example**:
```json
{
  "kind": "stream_chunk",
  "messageId": "456e7890-e89b-12d3-a456-426614174111",
  "chunk": "Based on the Q3 report,"
}
```

**Client Behavior**:
- Append chunk to message content
- Update UI incrementally (smooth streaming effect)

---

### 3. Stream End Message

**Purpose**: Signal completion of streaming response and provide metadata

**Format**:
```typescript
interface StreamEndMessage {
  kind: 'stream_end';
  messageId: string;
  conversationId: string;
  metadata: {
    tokensUsed: number;
    latencyMs: number;
    agentUsed: string;
    modelUsed: string;
  };
}
```

**Example**:
```json
{
  "kind": "stream_end",
  "messageId": "456e7890-e89b-12d3-a456-426614174111",
  "conversationId": "123e4567-e89b-12d3-a456-426614174000",
  "metadata": {
    "tokensUsed": 287,
    "latencyMs": 1823,
    "agentUsed": "rag",
    "modelUsed": "claude-sonnet-4.5"
  }
}
```

**Client Behavior**:
- Hide typing indicator
- Store metadata (for analytics/debugging)
- Mark message as complete

---

### 4. Progress Message

**Purpose**: Update progress for long-running operations (research jobs)

**Format**:
```typescript
interface ProgressMessage {
  kind: 'progress';
  jobId: string;  // UUID of research report
  progressPercent: number;  // 0-100
  status: string;  // Human-readable status
}
```

**Example**:
```json
{
  "kind": "progress",
  "jobId": "789e4567-e89b-12d3-a456-426614174999",
  "progressPercent": 45,
  "status": "Searching arXiv for quantum computing papers..."
}
```

**Client Behavior**:
- Update progress bar
- Display status message
- If user navigated away, store progress for display on return

---

### 5. Citation Message

**Purpose**: Provide source citations for RAG or Research responses

**Format**:
```typescript
interface CitationMessage {
  kind: 'citation';
  messageId: string;  // Associated assistant message
  sources: SearchSource[];
}

interface SearchSource {
  url: string;
  title: string;
  snippet: string;
  credibilityScore?: number;  // 0-100
  domain: string;
  publishDate?: string;  // ISO 8601
  author?: string;
  provider: string;  // 'rag' | 'tavily' | 'brave' | 'semantic_scholar' | etc.
}
```

**Example**:
```json
{
  "kind": "citation",
  "messageId": "456e7890-e89b-12d3-a456-426614174111",
  "sources": [
    {
      "url": "https://example.com/q3-report.pdf",
      "title": "Q3 2024 Financial Report",
      "snippet": "Revenue increased 25% to $45.2M...",
      "domain": "example.com",
      "provider": "rag"
    }
  ]
}
```

**Client Behavior**:
- Display citations below message
- Make sources clickable (if URL is external) or show document reference (if internal)
- Show credibility score if available

---

### 6. Error Message

**Purpose**: Communicate errors during message processing

**Format**:
```typescript
interface ErrorMessage {
  kind: 'error';
  error: string;  // Human-readable error message
  code: string;  // Machine-readable error code
  conversationId?: string;
  messageId?: string;
}
```

**Error Codes**:
- `UNAUTHORIZED`: Invalid or expired token
- `RATE_LIMITED`: Too many requests
- `VALIDATION_ERROR`: Invalid message format
- `LLM_ERROR`: LLM API failure (after retries)
- `DATABASE_ERROR`: Database query failure
- `SAFETY_VIOLATION`: Request violates safety policies
- `CANCELLED`: Operation cancelled by user
- `TIMEOUT`: Operation exceeded time limit

**Example**:
```json
{
  "kind": "error",
  "error": "Rate limit exceeded. Please wait 30 seconds.",
  "code": "RATE_LIMITED",
  "conversationId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Client Behavior**:
- Display error message to user (friendly version)
- Log error details for debugging
- Remove typing indicator if present

---

### 7. Pong Message

**Purpose**: Response to ping for latency measurement

**Format**:
```typescript
interface PongMessage {
  kind: 'pong';
  timestamp: number;  // Echoed from ping
  serverTime: number;  // Server timestamp in milliseconds
}
```

**Example**:
```json
{
  "kind": "pong",
  "timestamp": 1699564800000,
  "serverTime": 1699564800123
}
```

**Client Behavior**:
- Calculate latency: `serverTime - timestamp`
- Display connection quality indicator if needed

---

## Message Flows

### Flow 1: Simple Chat Message

```
Client                          Server
  |                               |
  |-------- ChatMessage --------->|
  |                               | (Master Agent classifies intent)
  |<------ StreamStartMessage ----|
  |<------ StreamChunkMessage ----|
  |<------ StreamChunkMessage ----|
  |<------ StreamChunkMessage ----|
  |<------- StreamEndMessage -----|
  |                               |
```

### Flow 2: RAG Query with Citations

```
Client                          Server
  |                               |
  |-------- ChatMessage --------->|
  |                               | (Master routes to RAG Agent)
  |<------ StreamStartMessage ----|
  |                               | (Retrieve chunks from DB)
  |<------ StreamChunkMessage ----|
  |<------ StreamChunkMessage ----|
  |<------ CitationMessage -------|  (Sources sent separately)
  |<------ StreamChunkMessage ----|
  |<------- StreamEndMessage -----|
  |                               |
```

### Flow 3: Research Request

```
Client                          Server
  |                               |
  |-------- ChatMessage --------->|
  |                               | (Master routes to Research Agent)
  |<------ StreamStartMessage ----|
  |                               | (Background job started)
  |<------ StreamChunkMessage ----|  "Starting research on..."
  |<------- StreamEndMessage -----|
  |                               |
  |                               | (Async research continues)
  |<------ ProgressMessage -------|  15%
  |<------ ProgressMessage -------|  30%
  |<------ ProgressMessage -------|  60%
  |<------ ProgressMessage -------|  100%
  |                               |
  |<------ StreamStartMessage ----|  (New message with report)
  |<------ StreamChunkMessage ----|
  |<------ CitationMessage -------|
  |<------ StreamChunkMessage ----|
  |<------- StreamEndMessage -----|
  |                               |
```

### Flow 4: SQL Query with Confirmation

```
Client                          Server
  |                               |
  |-------- ChatMessage --------->|  "How many users signed up?"
  |                               | (SQL Agent generates query)
  |<------ StreamStartMessage ----|
  |<------ StreamChunkMessage ----|  "I'll run this query:\n"
  |<------ StreamChunkMessage ----|  "SELECT COUNT(*) FROM users..."
  |<------ StreamChunkMessage ----|  "\nDoes this look correct?"
  |<------- StreamEndMessage -----|
  |                               |
  |-------- ChatMessage --------->|  "Yes, run it"
  |                               | (Execute query)
  |<------ StreamStartMessage ----|
  |<------ StreamChunkMessage ----|  "Found 1,247 users..."
  |<------- StreamEndMessage -----|
  |                               |
```

---

## Connection Lifecycle

### 1. Connection Established

```typescript
ws.onopen = () => {
  console.log('WebSocket connected');
  // Optional: Send ping to verify connection
  ws.send(JSON.stringify({
    kind: 'ping',
    timestamp: Date.now()
  }));
};
```

### 2. Receiving Messages

```typescript
ws.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);

  switch (message.kind) {
    case 'stream_start':
      handleStreamStart(message);
      break;
    case 'stream_chunk':
      handleStreamChunk(message);
      break;
    case 'stream_end':
      handleStreamEnd(message);
      break;
    case 'progress':
      handleProgress(message);
      break;
    case 'citation':
      handleCitation(message);
      break;
    case 'error':
      handleError(message);
      break;
    case 'pong':
      handlePong(message);
      break;
  }
};
```

### 3. Connection Closed

```typescript
ws.onclose = (event) => {
  console.log('WebSocket closed', event.code, event.reason);

  // Codes:
  // 1000: Normal closure
  // 4001: Unauthorized
  // 4029: Rate limited
  // 1006: Abnormal closure (network issue)

  if (event.code === 4001) {
    // Refresh token and reconnect
    refreshAuthToken().then(reconnect);
  } else if (event.code !== 1000) {
    // Unexpected closure, attempt reconnect with exponential backoff
    scheduleReconnect();
  }
};
```

### 4. Error Handling

```typescript
ws.onerror = (error) => {
  console.error('WebSocket error', error);
  // Browser will trigger onclose after onerror
};
```

---

## Reconnection Strategy

### Exponential Backoff

```typescript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    showConnectionError();
    return;
  }

  const delayMs = Math.min(
    BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
    30000  // Max 30 seconds
  );

  setTimeout(() => {
    reconnectAttempts++;
    connectWebSocket();
  }, delayMs);
}
```

### Successful Reconnection

```typescript
ws.onopen = () => {
  reconnectAttempts = 0;  // Reset counter
  // Resend any pending messages
  resendPendingMessages();
};
```

---

## Security

### Token Refresh

WebSocket connections should refresh auth tokens before expiry:

```typescript
const TOKEN_REFRESH_INTERVAL = 20 * 60 * 1000;  // 20 minutes (before 24h expiry)

setInterval(async () => {
  const newToken = await refreshAuthToken();
  // Close current connection and reconnect with new token
  ws.close(1000, 'Token refresh');
  connectWebSocket(newToken);
}, TOKEN_REFRESH_INTERVAL);
```

### Message Validation

Server validates all incoming messages:

```typescript
function validateChatMessage(msg: ChatMessage): boolean {
  // Check conversation ownership
  const conversation = await getConversation(msg.conversationId);
  if (conversation.userId !== authenticatedUserId) {
    sendError('UNAUTHORIZED', 'Invalid conversation ID');
    return false;
  }

  // Check content length
  if (!msg.content || msg.content.length > 10000) {
    sendError('VALIDATION_ERROR', 'Content must be 1-10000 characters');
    return false;
  }

  return true;
}
```

---

## Performance Considerations

### Batching

For high-frequency updates (progress), consider batching:

```typescript
// Server: Batch progress updates every 500ms
let pendingProgress: ProgressMessage | null = null;

setInterval(() => {
  if (pendingProgress) {
    ws.send(JSON.stringify(pendingProgress));
    pendingProgress = null;
  }
}, 500);
```

### Compression

For production, enable permessage-deflate compression:

```typescript
// Server (ws library)
const wss = new WebSocketServer({
  perMessageDeflate: {
    zlibDeflateOptions: {
      level: 6  // Balance between compression and CPU
    }
  }
});
```

---

## Testing

### Unit Tests

```typescript
// Test message serialization
test('ChatMessage serializes correctly', () => {
  const msg: ChatMessage = {
    kind: 'chat',
    conversationId: 'uuid',
    content: 'Hello'
  };
  expect(JSON.parse(JSON.stringify(msg))).toEqual(msg);
});
```

### Integration Tests

```typescript
// Test full message flow
test('Chat message returns streaming response', async () => {
  const ws = await connectTestWebSocket();
  const messages: ServerMessage[] = [];

  ws.on('message', (data) => {
    messages.push(JSON.parse(data.toString()));
  });

  ws.send(JSON.stringify({
    kind: 'chat',
    conversationId: 'test-conv',
    content: 'Hello'
  }));

  await waitForStreamEnd(messages);

  expect(messages[0].kind).toBe('stream_start');
  expect(messages[messages.length - 1].kind).toBe('stream_end');
});
```

---

## Protocol Versioning

Current version: **1.0.0**

Future changes:
- **PATCH**: Backward-compatible clarifications
- **MINOR**: New optional message types
- **MAJOR**: Breaking changes (new required fields, removed message types)

Version negotiation (future):
```json
{
  "kind": "handshake",
  "protocolVersion": "1.0.0",
  "clientCapabilities": ["streaming", "progress", "citations"]
}
```
