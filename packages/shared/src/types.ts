export interface User {
  id: string;
  username: string;
  publicKey: string;
  createdAt: string;
}

export interface Server {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberCount?: number;
}

export interface Channel {
  id: string;
  name: string;
  serverId: string;
  type: string;
  createdAt: string;
}

export interface Message {
  id: string;
  ciphertext: string;
  nonce: string;
  channelId: string;
  senderId: string;
  sender?: Pick<User, 'id' | 'username' | 'publicKey'>;
  createdAt: string;
  // Client-side decrypted content (not stored on server)
  content?: string;
}

export interface DirectMessage {
  id: string;
  ciphertext: string;
  nonce: string;
  senderId: string;
  recipientId: string;
  sender?: Pick<User, 'id' | 'username' | 'publicKey'>;
  createdAt: string;
  // Client-side decrypted content (not stored on server)
  content?: string;
}

export interface ServerMember {
  id: string;
  userId: string;
  serverId: string;
  role: string;
  encryptedKeys: string; // JSON: channelId -> base64 encrypted channel key
  user?: Pick<User, 'id' | 'username' | 'publicKey'>;
}

// WebSocket events sent from CLIENT to SERVER
export type WSClientEvent =
  | {
      type: 'authenticate';
      token: string;
    }
  | {
      type: 'subscribe_channel';
      channelId: string;
    }
  | {
      type: 'unsubscribe_channel';
      channelId: string;
    }
  | {
      type: 'subscribe_dm';
      userId: string;
    }
  | {
      type: 'ping';
    };

// WebSocket events sent from SERVER to CLIENT
export type WSServerEvent =
  | {
      type: 'authenticated';
      userId: string;
    }
  | {
      type: 'auth_error';
      message: string;
    }
  | {
      type: 'new_message';
      channelId: string;
      message: Message;
    }
  | {
      type: 'new_dm';
      dm: DirectMessage;
    }
  | {
      type: 'user_presence';
      userId: string;
      online: boolean;
    }
  | {
      type: 'keys_updated';
      serverId: string;
      encryptedKeys: string;
    }
  | {
      type: 'pong';
    }
  | {
      type: 'error';
      message: string;
    };
