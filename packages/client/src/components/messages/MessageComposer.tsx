'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import {
  encryptMessage,
  encryptDM,
  decodeBase64,
} from '@/lib/crypto';
import { messages as messagesApi, dm as dmApi, users as usersApi } from '@/lib/api';

interface MessageComposerProps {
  mode: 'channel' | 'dm';
  channelId?: string;
  serverId?: string;
  dmUserId?: string;
}

export function MessageComposer({ mode, channelId, serverId, dmUserId }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { channelKeys, channels, servers } = useChatStore();
  const { user, secretKey } = useAuthStore();

  const channel = channelId
    ? Object.values(channels).flat().find((c) => c.id === channelId)
    : null;

  const server = serverId
    ? servers.find((s) => s.id === serverId)
    : null;

  const channelKey = channelId ? channelKeys[channelId] : null;

  const canSend = () => {
    if (!text.trim()) return false;
    if (!user || !secretKey) return false;
    if (mode === 'channel' && !channelKey) return false;
    return true;
  };

  const handleSend = async () => {
    if (!canSend() || !user || !secretKey) return;

    const content = text.trim();
    setText('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setSending(true);
    try {
      if (mode === 'channel' && channelId && channelKey) {
        const { ciphertext, nonce } = encryptMessage(content, channelKey);
        await messagesApi.send(channelId, { ciphertext, nonce });
      } else if (mode === 'dm' && dmUserId) {
        // Fetch recipient's public key
        const recipient = await usersApi.getUser(dmUserId);
        const recipientPublicKey = decodeBase64(recipient.publicKey);
        const { ciphertext, nonce } = encryptDM(content, recipientPublicKey, secretKey);
        await dmApi.send(dmUserId, { ciphertext, nonce });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore the text if sending failed
      setText(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  const placeholder = () => {
    if (mode === 'channel') {
      if (!channelKey) return 'Waiting for channel key...';
      return `Message #${channel?.name ?? 'channel'}`;
    }
    return 'Send a direct message';
  };

  return (
    <div className="px-4 pb-4 flex-shrink-0">
      <div className="bg-nexus-surface border border-nexus-border rounded-xl overflow-hidden">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder()}
          disabled={sending || (mode === 'channel' && !channelKey)}
          rows={1}
          className="w-full px-4 py-3 bg-transparent text-nexus-text placeholder-nexus-muted resize-none focus:outline-none text-sm leading-relaxed disabled:cursor-not-allowed"
          style={{ minHeight: '48px', maxHeight: '200px' }}
        />

        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-nexus-accent">
            <span>&#128274;</span>
            <span>End-to-end encrypted</span>
            {server && (
              <span className="text-nexus-muted">
                &mdash; {server.name}
                {channel && ` / #${channel.name}`}
              </span>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend() || sending}
            className="px-3 py-1 bg-nexus-blue hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {mode === 'channel' && !channelKey && (
        <p className="text-xs text-yellow-500 mt-1 px-1">
          You don&apos;t have the channel key yet. An admin needs to share it with you.
        </p>
      )}
    </div>
  );
}
