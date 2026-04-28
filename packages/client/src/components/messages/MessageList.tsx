'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { decryptMessage, decryptDM, decodeBase64 } from '@/lib/crypto';
import { messages as messagesApi, dm as dmApi } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Message, DirectMessage } from '@nexus/shared';

interface MessageListProps {
  mode: 'channel' | 'dm';
  channelId?: string;
  serverId?: string;
  dmUserId?: string;
}

function decryptedContent(
  msg: Message | DirectMessage,
  mode: 'channel' | 'dm',
  channelKeys: Record<string, Uint8Array>,
  secretKey: Uint8Array | null,
  currentUserId: string
): string {
  // If already decrypted (e.g. from WebSocket handler)
  if ((msg as Message).content) return (msg as Message).content!;

  if (mode === 'channel') {
    const m = msg as Message;
    const key = channelKeys[m.channelId];
    if (!key) return '[encrypted - waiting for channel key]';
    try {
      return decryptMessage(m.ciphertext, m.nonce, key);
    } catch {
      return '[encrypted - decryption failed]';
    }
  } else {
    const m = msg as DirectMessage;
    if (!secretKey) return '[encrypted - private key not loaded]';
    try {
      const senderPublicKey = m.sender?.publicKey
        ? decodeBase64(m.sender.publicKey)
        : null;
      if (!senderPublicKey) return '[encrypted - missing sender key]';
      return decryptDM(m.ciphertext, m.nonce, senderPublicKey, secretKey);
    } catch {
      return '[encrypted - decryption failed]';
    }
  }
}

export function MessageList({ mode, channelId, dmUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const {
    messages,
    dmMessages,
    channelKeys,
    addMessage,
    addDmMessage,
    prependMessages,
    prependDmMessages,
  } = useChatStore();
  const { user, secretKey } = useAuthStore();
  const { subscribeToChannel } = useWebSocket();

  const key = mode === 'channel' ? channelId! : dmUserId!;
  const rawMessages = mode === 'channel' ? (messages[key] ?? []) : (dmMessages[key] ?? []);

  // Load initial messages
  useEffect(() => {
    if (mode === 'channel' && channelId) {
      subscribeToChannel(channelId);
      messagesApi.list(channelId).then((data) => {
        // Decrypt and set
        const decrypted = data.map((m) => ({
          ...m,
          content: (() => {
            const k = channelKeys[m.channelId];
            if (!k) return '[encrypted - waiting for channel key]';
            try { return decryptMessage(m.ciphertext, m.nonce, k); }
            catch { return '[encrypted - decryption failed]'; }
          })(),
        }));
        // Use prependMessages to avoid duplicating existing ones
        prependMessages(channelId, decrypted);
        setHasMore(data.length === 50);
      }).catch(console.error);
    } else if (mode === 'dm' && dmUserId) {
      dmApi.list(dmUserId).then((data) => {
        const decrypted = data.map((m) => ({
          ...m,
          content: (() => {
            if (!secretKey) return '[encrypted - private key not loaded]';
            try {
              const pk = m.sender?.publicKey ? decodeBase64(m.sender.publicKey) : null;
              if (!pk) return '[encrypted - missing sender key]';
              return decryptDM(m.ciphertext, m.nonce, pk, secretKey);
            } catch { return '[encrypted - decryption failed]'; }
          })(),
        }));
        prependDmMessages(dmUserId, decrypted);
        setHasMore(data.length === 50);
      }).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, dmUserId, mode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawMessages.length]);

  // Load more on scroll to top
  const handleScroll = useCallback(async () => {
    const container = containerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop > 100) return;

    const oldest = rawMessages[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const prevScrollHeight = container.scrollHeight;

      if (mode === 'channel' && channelId) {
        const data = await messagesApi.list(channelId, { before: oldest.createdAt });
        const decrypted = data.map((m) => ({
          ...m,
          content: (() => {
            const k = channelKeys[(m as Message).channelId ?? channelId];
            if (!k) return '[encrypted]';
            try { return decryptMessage(m.ciphertext, m.nonce, k); }
            catch { return '[encrypted - failed]'; }
          })(),
        })) as Message[];
        prependMessages(channelId, decrypted);
        setHasMore(data.length === 50);
        // Maintain scroll position
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      } else if (mode === 'dm' && dmUserId) {
        const data = await dmApi.list(dmUserId, { before: oldest.createdAt });
        const decrypted = data.map((m) => ({
          ...m,
          content: (() => {
            if (!secretKey) return '[encrypted]';
            try {
              const pk = m.sender?.publicKey ? decodeBase64(m.sender.publicKey) : null;
              if (!pk) return '[encrypted]';
              return decryptDM(m.ciphertext, m.nonce, pk, secretKey);
            } catch { return '[encrypted - failed]'; }
          })(),
        })) as DirectMessage[];
        prependDmMessages(dmUserId, decrypted);
        setHasMore(data.length === 50);
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, dmUserId, mode, rawMessages, channelKeys, secretKey, loadingMore, hasMore, prependMessages, prependDmMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Group consecutive messages from same sender
  const groupedMessages: Array<{
    senderId: string;
    username: string;
    timestamp: string;
    messages: Array<{ id: string; content: string; createdAt: string; ciphertext: string }>;
  }> = [];

  for (const msg of rawMessages) {
    const senderId = (msg as Message).senderId ?? (msg as DirectMessage).senderId;
    const username = (msg as Message).sender?.username ?? (msg as DirectMessage).sender?.username ?? 'Unknown';
    const content = decryptedContent(msg, mode, channelKeys, secretKey, user?.id ?? '');
    const last = groupedMessages[groupedMessages.length - 1];

    if (last && last.senderId === senderId) {
      last.messages.push({ id: msg.id, content, createdAt: msg.createdAt, ciphertext: msg.ciphertext });
    } else {
      groupedMessages.push({
        senderId,
        username,
        timestamp: msg.createdAt,
        messages: [{ id: msg.id, content, createdAt: msg.createdAt, ciphertext: msg.ciphertext }],
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
    >
      {loadingMore && (
        <div className="text-center text-nexus-muted text-sm py-2">Loading older messages...</div>
      )}

      {!hasMore && rawMessages.length > 0 && (
        <div className="text-center text-nexus-muted text-xs py-2">
          Beginning of conversation
        </div>
      )}

      {rawMessages.length === 0 && !loadingMore && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-3xl mb-2">&#128274;</div>
            <p className="text-nexus-muted text-sm">
              {mode === 'channel' ? 'No messages yet. Say hello!' : 'Start a conversation!'}
            </p>
            <p className="text-nexus-muted text-xs mt-1">All messages are end-to-end encrypted.</p>
          </div>
        </div>
      )}

      {groupedMessages.map((group, idx) => {
        const isMe = group.senderId === user?.id;
        return (
          <div key={`${group.senderId}-${group.timestamp}-${idx}`} className="flex gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-9 h-9 rounded-full bg-nexus-blue flex items-center justify-center text-white text-sm font-bold">
                {group.username[0]?.toUpperCase() ?? '?'}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`font-semibold text-sm ${isMe ? 'text-nexus-blue' : 'text-nexus-text'}`}>
                  {group.username}
                  {isMe && <span className="text-nexus-muted font-normal text-xs ml-1">(you)</span>}
                </span>
                <span className="text-nexus-muted text-xs" title={group.timestamp}>
                  {formatDistanceToNow(new Date(group.timestamp), { addSuffix: true })}
                </span>
              </div>

              {group.messages.map((m) => (
                <div key={m.id} className="group flex items-start gap-2">
                  <p className={`text-sm leading-relaxed flex-1 ${
                    m.content.startsWith('[encrypted')
                      ? 'text-nexus-muted italic'
                      : 'text-nexus-text'
                  }`}>
                    {m.content}
                  </p>
                  {/* Lock indicator */}
                  <span
                    className="flex-shrink-0 text-nexus-accent text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    title={`Encrypted message\nCiphertext: ${m.ciphertext.slice(0, 20)}...`}
                  >
                    &#128274;
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
