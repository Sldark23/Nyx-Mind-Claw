import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chatRouter } from './routes/chat';
import { setupWebSocket } from './ws/handler';

const PORT = process.env.PORT || 3000;

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/chat', chatRouter);
  return app;
}

export function startServer() {
  const app = createApp();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  setupWebSocket(wss);

  server.listen(PORT, () => {
    console.log(`🚀 Gateway running on http://localhost:${PORT}`);
    console.log(`   REST: http://localhost:${PORT}/chat`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  });

  return { app, server, wss };
}

if (require.main === module) {
  startServer();
}