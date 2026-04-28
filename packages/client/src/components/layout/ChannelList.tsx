'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import {
  generateChannelKey,
  encryptChannelKey,
  decryptChannelKey,
  decodeBase64,
  encodeBase64,
} from '@/lib/crypto';
import { channels as channelsApi, servers as serversApi } from '@/lib/api';
import { JoinServerModal } from '../modals/JoinServerModal';

interface ChannelListProps {
  serverId: string;
}

export function ChannelList({ serverId }: ChannelListProps) {
  const router = useRouter();
  const params = useParams();
  const currentChannelId = params?.channelId as string | undefined;

  const {
    servers,
    channels,
    setChannels,
    setChannelKey,
    channelKeys,
    members,
    setMembers,
  } = useChatStore();
  const { user, secretKey } = useAuthStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const server = servers.find((s) => s.id === serverId);
  const serverChannels = channels[serverId] ?? [];
  const serverMembers = members[serverId] ?? [];

  const isOwnerOrAdmin = () => {
    if (!user) return false;
    const member = serverMembers.find((m) => m.userId === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  };

  // Load and decrypt channel keys
  useEffect(() => {
    if (!user || !secretKey || !serverId) return;

    const loadKeys = async () => {
      try {
        const { encryptedKeys } = await channelsApi.getMyKeys(serverId);
        const keysMap = JSON.parse(encryptedKeys) as Record<string, string>;

        for (const [channelId, encryptedKey] of Object.entries(keysMap)) {
          if (!channelKeys[channelId]) {
            try {
              // The key was encrypted with our own public key, sender = ourselves
              const myPublicKey = decodeBase64(user.publicKey);
              const channelKey = decryptChannelKey(encryptedKey, myPublicKey, secretKey);
              setChannelKey(channelId, channelKey);
            } catch {
              // Key decryption failed, skip
            }
          }
        }
      } catch {
        // Ignore errors loading keys
      }
    };

    loadKeys();
  }, [serverId, user, secretKey, channelKeys, setChannelKey]);

  // Load members
  useEffect(() => {
    if (!serverId || !user) return;

    serversApi.getMembers(serverId).then((data) => {
      setMembers(serverId, data.map((m) => ({
        id: m.id,
        userId: m.userId,
        serverId: m.serverId,
        role: m.role,
        encryptedKeys: m.encryptedKeys,
        user: m.user,
      })));
    }).catch(console.error);
  }, [serverId, user, setMembers]);

  const handleChannelClick = (channelId: string) => {
    router.push(`/channels/${serverId}/${channelId}`);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !user || !secretKey) return;

    try {
      // Generate a new channel key
      const channelKey = generateChannelKey();
      const myPublicKey = decodeBase64(user.publicKey);
      const encryptedKey = encryptChannelKey(channelKey, myPublicKey, secretKey);

      const channel = await channelsApi.create(serverId, newChannelName, encryptedKey);

      // Store the key locally
      setChannelKey(channel.id, channelKey);

      // Refresh channels
      const updatedChannels = await channelsApi.list(serverId);
      setChannels(serverId, updatedChannels);

      setNewChannelName('');
      setCreatingChannel(false);
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  return (
    <>
      <div className="w-60 flex-shrink-0 bg-nexus-sidebar border-r border-nexus-border flex flex-col">
        {/* Server header */}
        <div className="px-4 py-3 border-b border-nexus-border">
          <h2 className="font-semibold text-nexus-text truncate">{server?.name ?? 'Server'}</h2>
          <p className="text-xs text-nexus-muted mt-0.5">
            {server?.memberCount ?? serverMembers.length} members
          </p>
        </div>

        {/* Invite / Join section */}
        <div className="px-3 py-2 border-b border-nexus-border">
          <div className="text-xs text-nexus-muted mb-1">Server ID (invite code):</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-nexus-text bg-nexus-bg rounded px-2 py-1 flex-1 truncate">
              {serverId}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(serverId);
              }}
              className="text-xs text-nexus-blue hover:underline"
              title="Copy server ID"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            className="mt-2 text-xs text-nexus-blue hover:underline"
          >
            + Join another server
          </button>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex items-center justify-between px-2 mb-1">
            <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">
              Channels
            </span>
            {isOwnerOrAdmin() && (
              <button
                onClick={() => setCreatingChannel(true)}
                className="text-nexus-muted hover:text-nexus-text text-lg leading-none"
                title="Create channel"
              >
                +
              </button>
            )}
          </div>

          {serverChannels.map((channel) => {
            const isActive = channel.id === currentChannelId;
            const hasKey = !!channelKeys[channel.id];
            return (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel.id)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left
                  transition-colors
                  ${isActive
                    ? 'bg-nexus-surface text-nexus-text'
                    : 'text-nexus-muted hover:text-nexus-text hover:bg-nexus-surface/50'
                  }
                `}
              >
                <span className="text-nexus-muted">#</span>
                <span className="truncate flex-1">{channel.name}</span>
                {hasKey ? (
                  <span className="text-nexus-accent text-xs" title="Encrypted">&#128274;</span>
                ) : (
                  <span className="text-yellow-500 text-xs" title="No key">&#9888;</span>
                )}
              </button>
            );
          })}

          {/* Create channel form */}
          {creatingChannel && (
            <div className="px-2 mt-2">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="channel-name"
                autoFocus
                className="w-full px-2 py-1 bg-nexus-bg border border-nexus-border rounded text-sm text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-blue"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChannel();
                  if (e.key === 'Escape') setCreatingChannel(false);
                }}
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleCreateChannel}
                  className="text-xs text-nexus-accent hover:underline"
                >
                  Create
                </button>
                <button
                  onClick={() => setCreatingChannel(false)}
                  className="text-xs text-nexus-muted hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showJoinModal && (
        <JoinServerModal onClose={() => setShowJoinModal(false)} />
      )}
    </>
  );
}
