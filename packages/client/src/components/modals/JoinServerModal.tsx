'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { servers as serversApi } from '@/lib/api';

interface JoinServerModalProps {
  onClose: () => void;
}

export function JoinServerModal({ onClose }: JoinServerModalProps) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addServer, setChannels } = useChatStore();
  const { user } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !user) return;

    setLoading(true);
    setError(null);

    try {
      const result = await serversApi.join(inviteCode.trim());

      if (result.alreadyMember) {
        // Already a member, just navigate
        onClose();
        router.push(`/channels/${result.id}/${result.channels?.[0]?.id ?? ''}`);
        return;
      }

      addServer({
        id: result.id,
        name: result.name,
        ownerId: result.ownerId,
        createdAt: result.createdAt,
      });

      if (result.channels?.length > 0) {
        setChannels(result.id, result.channels);
      }

      onClose();
      router.push(`/channels/${result.id}/${result.channels?.[0]?.id ?? ''}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-nexus-sidebar border border-nexus-border rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-nexus-text mb-1">Join a Server</h2>
        <p className="text-nexus-muted text-sm mb-6">
          Enter the server&apos;s invite code (Server ID) to join.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-nexus-muted mb-1">
              Invite Code / Server ID
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="clxxxxxxxxxxxxxxxxxxxx"
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-blue font-mono"
              disabled={loading}
            />
            <p className="text-xs text-nexus-muted mt-1">
              You can find the server ID in the channel list of the server you want to join.
            </p>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-3 py-2 text-xs text-yellow-400">
            <strong>Note:</strong> After joining, an admin must share the channel encryption keys with you before you can read messages.
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
              disabled={loading || !inviteCode.trim()}
              className="px-4 py-2 bg-nexus-blue hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
