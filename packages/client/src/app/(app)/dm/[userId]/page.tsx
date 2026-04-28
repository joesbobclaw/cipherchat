'use client';

import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';

interface DMPageProps {
  params: {
    userId: string;
  };
}

export default function DMPage({ params }: DMPageProps) {
  const { userId } = params;

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <MessageList
        key={userId}
        dmUserId={userId}
        mode="dm"
      />
      <MessageComposer
        dmUserId={userId}
        mode="dm"
      />
    </div>
  );
}
