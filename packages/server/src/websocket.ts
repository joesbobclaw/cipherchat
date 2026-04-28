import { WebSocket, WebSocketServer } from 'ws';
import { WSClientEvent, WSServerEvent } from '@nexus/shared';
import jwt from 'jsonwebtoken';

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  subscribedChannels: Set<string>;
}

// userId -> Set of WebSocket connections
export const userConnections = new Map<string, Set<WebSocket>>();

// channelId -> Set of authenticated clients subscribed to that channel
const channelSubscriptions = new Map<string, Set<AuthenticatedClient>>();

// wsId -> AuthenticatedClient (for lookup by ws reference)
const clientMap = new Map<WebSocket, AuthenticatedClient>();

function sendEvent(ws: WebSocket, event: WSServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function broadcastToChannel(channelId: string, event: WSServerEvent): void {
  const subscribers = channelSubscriptions.get(channelId);
  if (!subscribers) return;
  for (const client of subscribers) {
    sendEvent(client.ws, event);
  }
}

export function broadcastDM(senderId: string, recipientId: string, event: WSServerEvent): void {
  // Send to all connections of the recipient
  const recipientSockets = userConnections.get(recipientId);
  if (recipientSockets) {
    for (const ws of recipientSockets) {
      sendEvent(ws, event);
    }
  }
  // Also echo to sender's other connections
  const senderSockets = userConnections.get(senderId);
  if (senderSockets) {
    for (const ws of senderSockets) {
      sendEvent(ws, event);
    }
  }
}

export function broadcastPresence(userId: string, online: boolean): void {
  const presenceEvent: WSServerEvent = { type: 'user_presence', userId, online };
  for (const [, sockets] of userConnections) {
    for (const ws of sockets) {
      sendEvent(ws, presenceEvent);
    }
  }
}

export function setupWebSocket(wss: WebSocketServer): void {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';

  wss.on('connection', (ws: WebSocket) => {
    let authenticated = false;
    let client: AuthenticatedClient | null = null;

    // Ping/pong keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('pong', () => {
      // Client is alive
    });

    ws.on('message', (data: Buffer) => {
      let event: WSClientEvent;
      try {
        event = JSON.parse(data.toString()) as WSClientEvent;
      } catch {
        sendEvent(ws, { type: 'error', message: 'Invalid JSON' });
        return;
      }

      if (!authenticated) {
        if (event.type !== 'authenticate') {
          sendEvent(ws, { type: 'auth_error', message: 'Must authenticate first' });
          return;
        }

        try {
          const payload = jwt.verify(event.token, jwtSecret) as {
            id: string;
            username: string;
          };

          client = {
            ws,
            userId: payload.id,
            username: payload.username,
            subscribedChannels: new Set(),
          };

          authenticated = true;
          clientMap.set(ws, client);

          // Track user connections
          if (!userConnections.has(payload.id)) {
            userConnections.set(payload.id, new Set());
          }
          userConnections.get(payload.id)!.add(ws);

          sendEvent(ws, { type: 'authenticated', userId: payload.id });
          broadcastPresence(payload.id, true);
        } catch {
          sendEvent(ws, { type: 'auth_error', message: 'Invalid token' });
          ws.close();
        }
        return;
      }

      if (!client) return;

      switch (event.type) {
        case 'subscribe_channel': {
          const channelId = event.channelId;
          client.subscribedChannels.add(channelId);
          if (!channelSubscriptions.has(channelId)) {
            channelSubscriptions.set(channelId, new Set());
          }
          channelSubscriptions.get(channelId)!.add(client);
          break;
        }

        case 'unsubscribe_channel': {
          const channelId = event.channelId;
          client.subscribedChannels.delete(channelId);
          channelSubscriptions.get(channelId)?.delete(client);
          break;
        }

        case 'subscribe_dm': {
          // DMs are routed by userId, so the user's connection already handles this.
          // No extra subscription needed since broadcastDM uses userConnections.
          break;
        }

        case 'ping': {
          sendEvent(ws, { type: 'pong' });
          break;
        }
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);

      if (client) {
        // Remove from channel subscriptions
        for (const channelId of client.subscribedChannels) {
          channelSubscriptions.get(channelId)?.delete(client!);
        }

        // Remove from user connections
        const userSockets = userConnections.get(client.userId);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            userConnections.delete(client.userId);
            broadcastPresence(client.userId, false);
          }
        }

        clientMap.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  });

  wss.on('error', (err) => {
    console.error('[WSS] Server error:', err.message);
  });
}
