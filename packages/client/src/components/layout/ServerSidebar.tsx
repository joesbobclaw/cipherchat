'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getKeyFingerprint, decodeBase64 } from '@/lib/crypto';
import { CreateServerModal } from '../modals/CreateServerModal';

export function ServerSidebar() {
  const router = useRouter();
  const params = useParams();
  const currentServerId = params?.serverId as string | undefined;

  const { servers } = useChatStore();
  const { user } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const fingerprint = user?.publicKey
    ? getKeyFingerprint(decodeBase64(user.publicKey))
    : null;

  const handleServerClick = (serverId: string) => {
    router.push(`/channels/${serverId}`);
  };

  const handleHomeClick = () => {
    router.push('/channels');
  };

  return (
    <>
      <div className="w-[72px] flex-shrink-0 bg-nexus-bg border-r border-nexus-border flex flex-col items-center py-3 gap-2">
        {/* Home / DM button */}
        <button
          onClick={handleHomeClick}
          className="w-12 h-12 rounded-2xl bg-nexus-sidebar hover:bg-nexus-blue transition-all duration-150 flex items-center justify-center text-nexus-text font-bold text-lg"
          title="Direct Messages"
        >
          <span className="text-xl">&#128274;</span>
        </button>

        <div className="w-8 h-px bg-nexus-border" />

        {/* Server list */}
        <div className="flex flex-col items-center gap-2 flex-1 w-full overflow-y-auto px-3">
          {servers.map((server) => {
            const isActive = server.id === currentServerId;
            return (
              <button
                key={server.id}
                onClick={() => handleServerClick(server.id)}
                title={server.name}
                className={`
                  w-12 h-12 rounded-2xl transition-all duration-150 flex items-center justify-center
                  font-bold text-sm uppercase select-none
                  ${isActive
                    ? 'bg-nexus-blue text-white rounded-xl'
                    : 'bg-nexus-surface text-nexus-text hover:bg-nexus-blue hover:text-white hover:rounded-xl'
                  }
                `}
              >
                {server.name.slice(0, 2)}
              </button>
            );
          })}
        </div>

        <div className="w-8 h-px bg-nexus-border" />

        {/* Add server button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-12 h-12 rounded-2xl bg-nexus-surface hover:bg-nexus-accent text-nexus-muted hover:text-white transition-all duration-150 flex items-center justify-center text-2xl font-light"
          title="Create a server"
        >
          +
        </button>

        {/* User info at bottom */}
        <div className="mt-auto">
          <div
            className="w-10 h-10 rounded-full bg-nexus-blue flex items-center justify-center text-white font-bold text-sm cursor-default select-none"
            title={fingerprint ? `Key fingerprint: ${fingerprint}` : user?.username ?? ''}
          >
            {user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          {fingerprint && (
            <div className="text-nexus-muted text-[9px] text-center mt-0.5 font-mono leading-tight">
              {fingerprint.slice(0, 8)}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateServerModal onClose={() => setShowCreateModal(false)} />
      )}
    </>
  );
}
