import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { serverRoutes } from './routes/servers';
import { channelRoutes } from './routes/channels';
import { messageRoutes } from './routes/messages';
import { dmRoutes } from './routes/dm';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const WS_PORT = parseInt(process.env.WS_PORT ?? '4001', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

async function start(): Promise<void> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: [CLIENT_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // JWT
  await fastify.register(jwt, {
    secret: JWT_SECRET,
  });

  // Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(serverRoutes, { prefix: '/api/servers' });
  await fastify.register(channelRoutes, { prefix: '/api/servers' });
  await fastify.register(messageRoutes, { prefix: '/api/channels' });
  await fastify.register(dmRoutes, { prefix: '/api/dm' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start HTTP server
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`HTTP server listening on port ${PORT}`);

  // Start WebSocket server on a separate port
  const wss = new WebSocketServer({ port: WS_PORT });
  setupWebSocket(wss);
  console.log(`WebSocket server listening on port ${WS_PORT}`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
