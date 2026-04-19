import { WebSocketServer, WebSocket } from 'ws';

interface ChatMessage {
  type: 'message' | 'typing' | 'stop';
  content?: string;
  conversationId?: string;
}

interface Client {
  ws: WebSocket;
  id: string;
  conversationId?: string;
}

const clients = new Map<WebSocket, Client>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket) => {
    const clientId = generateId();
    clients.set(ws, { ws, id: clientId });
    console.log(`[WS] Client connected: ${clientId}`);

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as ChatMessage;
        handleMessage(ws, msg);
      } catch (err) {
        console.error('[WS] Invalid message:', err);
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        console.log(`[WS] Client disconnected: ${client.id}`);
        clients.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err);
    });
  });
}

function handleMessage(ws: WebSocket, msg: ChatMessage) {
  switch (msg.type) {
    case 'message':
      if (msg.content) {
        // TODO: Connect to core agent loop
        const response = { type: 'message', content: `Echo: ${msg.content}` };
        ws.send(JSON.stringify(response));
      }
      break;
    case 'typing':
      // Handle typing indicator
      break;
    case 'stop':
      // Stop generation
      break;
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}