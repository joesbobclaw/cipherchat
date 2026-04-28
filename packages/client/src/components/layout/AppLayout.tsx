'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ServerSidebar } from './ServerSidebar';
import { ChannelList } from './ChannelList';
import { MemberList } from './MemberList';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { servers as serversApi, channels as channelsApi } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const params = useParams();
  const serverId = params?.serverId as string | undefined;

  const { setServers, setChannels, activeServerId, setActiveServer } = useChatStore();
  const { token } = useAuthStore();

  // Initialize WebSocket connection
  useWebSocket();

  // Load servers on mount
  useEffect(() => {
    if (!token) return;

    serversApi.list().then((data) => {
      // Each server includes channels from the list endpoint
      setServers(
        data.map((s) => ({
          id: s.id,
          name: s.name,
          ownerId: s.ownerId,
          createdAt: s.createdAt,
          memberCount: s.memberCount,
        }))
      );
      // Set channels for each server
      for (const server of data) {
        if (server.channels) {
          setChannels(server.id, server.channels);
        }
      }
    }).catch(console.error);
  }, [token, setServers, setChannels]);

  // Sync active server from URL
  useEffect(() => {
    if (serverId && serverId !== activeServerId) {
      setActiveServer(serverId);
      // Load channels for this server
      channelsApi.list(serverId).then((chs) => {
        setChannels(serverId, chs);
      }).catch(console.error);
    } else if (!serverId && activeServerId) {
      setActiveServer(null);
    }
  }, [serverId, activeServerId, setActiveServer, setChannels]);

  const showChannelList = !!serverId;
  const showMemberList = !!serverId;

  return (
    <div className="flex h-screen bg-nexus-bg overflow-hidden">
      {/* Server sidebar - narrow */}
      <ServerSidebar />

      {/* Channel list - only when a server is selected */}
      {showChannelList && (
        <ChannelList serverId={serverId} />
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>

      {/* Member list - only when a server is selected */}
      {showMemberList && (
        <MemberList serverId={serverId} />
      )}
    </div>
  );
}
