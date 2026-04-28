'use client';

import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';

interface ChannelPageProps {
  params: {
    serverId: string;
    channelId: string;
  };
}

export default function ChannelPage({ params }: ChannelPageProps) {
  const { serverId, channelId } = params;

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <MessageList
        key={channelId}
        channelId={channelId}
        serverId={serverId}
        mode="channel"
      />
      <MessageComposer
        channelId={channelId}
        serverId={serverId}
        mode="channel"
      />
    </div>
  );
}
