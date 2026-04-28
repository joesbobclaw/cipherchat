'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import {
  generateChannelKey,
  encryptChannelKey,
  decodeBase64,
} from '@/lib/crypto';
import { servers as serversApi } from '@/lib/api';

interface CreateServerModalProps {
  onClose: () => void;
}

export function CreateServerModal({ onClose }: CreateServerModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addServer, setChannels, setChannelKey } = useChatStore();
  const { user, secretKey } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || !secretKey) return;

    setLoading(true);
    setError(null);

    try {
      // Generate a channel key for the "general" channel (created automatically)
      const channelKey = generateChannelKey();
      const myPublicKey = decodeBase64(user.publicKey);
      const encryptedChannelKey = encryptChannelKey(channelKey, myPublicKey, secretKey);

      const server = await serversApi.create(name.trim(), encryptedChannelKey);

      addServer({
        id: server.id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
      });

      if (server.channels?.length > 0) {
        setChannels(server.id, server.channels);
        // Store the channel key for each channel (just "general" initially)
        for (const channel of server.channels) {
          setChannelKey(channel.id, channelKey);
        }
      }

      onClose();
      router.push(`/channels/${server.id}/${server.channels?.[0]?.id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-nexus-sidebar border border-nexus-border rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-nexus-text mb-1">Create a Server</h2>
        <p className="text-nexus-muted text-sm mb-6">
          Your server will get a &quot;general&quot; channel with a unique encryption key.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1">
              Server Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Encrypted Server"
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-blue"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-nexus-muted hover:text-nexus-text transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-nexus-blue hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
