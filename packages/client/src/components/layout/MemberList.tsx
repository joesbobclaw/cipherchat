'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import {
  encryptChannelKey,
  decodeBase64,
} from '@/lib/crypto';
import { servers as serversApi, channels as channelsApi } from '@/lib/api';

interface MemberListProps {
  serverId: string;
}

export function MemberList({ serverId }: MemberListProps) {
  const { members, setMembers, onlineUsers, channelKeys, channels } = useChatStore();
  const { user, secretKey } = useAuthStore();

  const serverMembers = members[serverId] ?? [];
  const serverChannels = channels[serverId] ?? [];

  useEffect(() => {
    if (!serverId || !user) return;

    serversApi.getMembers(serverId).then((data) => {
      setMembers(
        serverId,
        data.map((m) => ({
          id: m.id,
          userId: m.userId,
          serverId: m.serverId,
          role: m.role,
          encryptedKeys: m.encryptedKeys,
          user: m.user,
        }))
      );
    }).catch(console.error);
  }, [serverId, user, setMembers]);

  const onlineMembers = serverMembers.filter((m) => onlineUsers.has(m.userId));
  const offlineMembers = serverMembers.filter((m) => !onlineUsers.has(m.userId));

  const isOwnerOrAdmin = () => {
    if (!user) return false;
    const member = serverMembers.find((m) => m.userId === user.id);
    return member?.role === 'owner' || member?.role === 'admin';
  };

  const handleShareKeys = async (targetMember: typeof serverMembers[0]) => {
    if (!user || !secretKey || !isOwnerOrAdmin()) return;

    try {
      const myPublicKey = decodeBase64(user.publicKey);
      const recipientPublicKey = targetMember.user?.publicKey
        ? decodeBase64(targetMember.user.publicKey)
        : null;

      if (!recipientPublicKey) return;

      // Build encrypted keys map for the target user
      const encryptedKeysMap: Record<string, string> = {};

      for (const channel of serverChannels) {
        const channelKey = channelKeys[channel.id];
        if (channelKey) {
          const encrypted = encryptChannelKey(channelKey, recipientPublicKey, secretKey);
          encryptedKeysMap[channel.id] = encrypted;
        }
      }

      await serversApi.updateMemberKeys(
        serverId,
        targetMember.userId,
        JSON.stringify(encryptedKeysMap)
      );

      alert(`Keys shared with ${targetMember.user?.username ?? 'user'}`);
    } catch (err) {
      console.error('Failed to share keys:', err);
      alert('Failed to share keys');
    }
  };

  const MemberItem = ({ member }: { member: typeof serverMembers[0] }) => {
    const isOnline = onlineUsers.has(member.userId);
    const isMe = member.userId === user?.id;
    const hasEmptyKeys = member.encryptedKeys === '{}';
    const canShareKeys = isOwnerOrAdmin() && !isMe && hasEmptyKeys;

    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-nexus-surface/50 group">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-nexus-blue flex items-center justify-center text-white text-xs font-bold">
            {member.user?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-nexus-sidebar ${
              isOnline ? 'bg-nexus-accent' : 'bg-nexus-muted'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-nexus-text truncate">
              {member.user?.username ?? 'Unknown'}
              {isMe && (
                <span className="text-nexus-muted text-xs ml-1">(you)</span>
              )}
            </span>
          </div>
          <div className="text-xs text-nexus-muted capitalize">{member.role}</div>
        </div>
        {canShareKeys && (
          <button
            onClick={() => handleShareKeys(member)}
            className="hidden group-hover:block text-xs text-nexus-blue hover:underline flex-shrink-0"
            title="Share encryption keys"
          >
            Share keys
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-60 flex-shrink-0 bg-nexus-sidebar border-l border-nexus-border flex flex-col">
      <div className="px-4 py-3 border-b border-nexus-border">
        <h3 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider">
          Members
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {onlineMembers.length > 0 && (
          <div className="mb-3">
            <div className="px-2 mb-1 text-xs font-semibold text-nexus-muted uppercase tracking-wider">
              Online — {onlineMembers.length}
            </div>
            {onlineMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {offlineMembers.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-xs font-semibold text-nexus-muted uppercase tracking-wider">
              Offline — {offlineMembers.length}
            </div>
            {offlineMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {serverMembers.length === 0 && (
          <div className="px-2 text-sm text-nexus-muted">No members found</div>
        )}
      </div>
    </div>
  );
}
