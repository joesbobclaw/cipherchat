'use client';

export default function ChannelsIndexPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-nexus-bg">
      <div className="text-center">
        <div className="text-4xl mb-4">&#128274;</div>
        <h2 className="text-xl font-semibold text-nexus-text mb-2">
          Welcome to Nexus Chat
        </h2>
        <p className="text-nexus-muted">
          Select a server and channel to start chatting.
        </p>
        <p className="text-nexus-muted text-sm mt-1">
          All messages are end-to-end encrypted.
        </p>
      </div>
    </div>
  );
}
