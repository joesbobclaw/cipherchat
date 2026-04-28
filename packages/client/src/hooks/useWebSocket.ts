'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { decryptMessage, decryptDM, decodeBase64 } from '@/lib/crypto';
import { WSServerEvent } from '@nexus/shared';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4001';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

let globalWs: WebSocket | null = null;
let subscribedChannels = new Set<string>();

export function useWebSocket() {
  const { token, user, secretKey } = useAuthStore();
  const {
    addMessage,
    addDmMessage,
    setUserOnline,
    channelKeys,
  } = useChatStore();

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!token || !user) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    globalWs = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Authenticate
      ws.send(JSON.stringify({ type: 'authenticate', token }));

      // Re-subscribe to tracked channels
      for (const channelId of subscribedChannels) {
        ws.send(JSON.stringify({ type: 'subscribe_channel', channelId }));
      }
    };

    ws.onmessage = (event) => {
      let serverEvent: WSServerEvent;
      try {
        serverEvent = JSON.parse(event.data as string) as WSServerEvent;
      } catch {
        return;
      }

      switch (serverEvent.type) {
        case 'authenticated': {
          break;
        }

        case 'new_message': {
          const { channelId, message } = serverEvent;
          const channelKey = channelKeys[channelId];
          let content: string | undefined;

          if (channelKey) {
            try {
              content = decryptMessage(message.ciphertext, message.nonce, channelKey);
            } catch {
              content = '[encrypted - decryption failed]';
            }
          } else {
            content = '[encrypted - waiting for channel key]';
          }

          addMessage(channelId, {
            ...message,
            content,
          });
          break;
        }

        case 'new_dm': {
          const { dm } = serverEvent;
          if (!secretKey) break;

          const otherUserId =
            dm.senderId === user.id ? dm.recipientId : dm.senderId;

          let content: string | undefined;
          try {
            // Determine which public key to use for decryption
            // If we're the recipient, the sender's public key is needed
            // If we're the sender, we need our own public key to decrypt
            const senderPublicKey = dm.sender?.publicKey
              ? decodeBase64(dm.sender.publicKey)
              : null;

            if (senderPublicKey) {
              content = decryptDM(dm.ciphertext, dm.nonce, senderPublicKey, secretKey);
            } else {
              content = '[encrypted - missing sender key]';
            }
          } catch {
            content = '[encrypted - decryption failed]';
          }

          addDmMessage(otherUserId, {
            ...dm,
            content,
          });
          break;
        }

        case 'user_presence': {
          setUserOnline(serverEvent.userId, serverEvent.online);
          break;
        }
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      globalWs = null;

      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, user, secretKey, channelKeys, addMessage, addDmMessage, setUserOnline]);

  useEffect(() => {
    if (token && user) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token, user, connect]);

  const subscribeToChannel = useCallback((channelId: string) => {
    subscribedChannels.add(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'subscribe_channel', channelId })
      );
    }
  }, []);

  const unsubscribeFromChannel = useCallback((channelId: string) => {
    subscribedChannels.delete(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'unsubscribe_channel', channelId })
      );
    }
  }, []);

  const subscribeToDM = useCallback((userId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_dm', userId }));
    }
  }, []);

  return {
    status,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribeToDM,
  };
}
