import { create } from 'zustand';
import { Server, Channel, Message, DirectMessage, ServerMember } from '@nexus/shared';

interface ChatState {
  servers: Server[];
  channels: Record<string, Channel[]>; // serverId -> channels
  messages: Record<string, Message[]>; // channelId -> messages
  dmMessages: Record<string, DirectMessage[]>; // userId -> DMs
  channelKeys: Record<string, Uint8Array>; // channelId -> decrypted channel key
  members: Record<string, ServerMember[]>; // serverId -> members
  onlineUsers: Set<string>;
  activeServerId: string | null;
  activeChannelId: string | null;
  activeDmUserId: string | null;

  // Actions
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  setChannels: (serverId: string, channels: Channel[]) => void;
  addChannel: (serverId: string, channel: Channel) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  addMessage: (channelId: string, message: Message) => void;
  prependMessages: (channelId: string, messages: Message[]) => void;
  setDmMessages: (userId: string, messages: DirectMessage[]) => void;
  addDmMessage: (userId: string, message: DirectMessage) => void;
  prependDmMessages: (userId: string, messages: DirectMessage[]) => void;
  setChannelKey: (channelId: string, key: Uint8Array) => void;
  setMembers: (serverId: string, members: ServerMember[]) => void;
  setUserOnline: (userId: string, online: boolean) => void;
  setActiveServer: (serverId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  setActiveDmUser: (userId: string | null) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  servers: [],
  channels: {},
  messages: {},
  dmMessages: {},
  channelKeys: {},
  members: {},
  onlineUsers: new Set(),
  activeServerId: null,
  activeChannelId: null,
  activeDmUserId: null,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers.filter((s) => s.id !== server.id), server],
    })),

  setChannels: (serverId, channels) =>
    set((state) => ({
      channels: { ...state.channels, [serverId]: channels },
    })),

  addChannel: (serverId, channel) =>
    set((state) => ({
      channels: {
        ...state.channels,
        [serverId]: [
          ...(state.channels[serverId] ?? []).filter((c) => c.id !== channel.id),
          channel,
        ],
      },
    })),

  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [channelId]: messages },
    })),

  addMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messages[channelId] ?? [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [channelId]: [...existing, message],
        },
      };
    }),

  prependMessages: (channelId, messages) =>
    set((state) => {
      const existing = state.messages[channelId] ?? [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      return {
        messages: {
          ...state.messages,
          [channelId]: [...newMessages, ...existing],
        },
      };
    }),

  setDmMessages: (userId, messages) =>
    set((state) => ({
      dmMessages: { ...state.dmMessages, [userId]: messages },
    })),

  addDmMessage: (userId, message) =>
    set((state) => {
      const existing = state.dmMessages[userId] ?? [];
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        dmMessages: {
          ...state.dmMessages,
          [userId]: [...existing, message],
        },
      };
    }),

  prependDmMessages: (userId, messages) =>
    set((state) => {
      const existing = state.dmMessages[userId] ?? [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      return {
        dmMessages: {
          ...state.dmMessages,
          [userId]: [...newMessages, ...existing],
        },
      };
    }),

  setChannelKey: (channelId, key) =>
    set((state) => ({
      channelKeys: { ...state.channelKeys, [channelId]: key },
    })),

  setMembers: (serverId, members) =>
    set((state) => ({
      members: { ...state.members, [serverId]: members },
    })),

  setUserOnline: (userId, online) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      if (online) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return { onlineUsers: next };
    }),

  setActiveServer: (serverId) => set({ activeServerId: serverId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setActiveDmUser: (userId) => set({ activeDmUserId: userId }),
}));
