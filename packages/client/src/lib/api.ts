import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

// Auth
export const auth = {
  register: (data: {
    username: string;
    password: string;
    publicKey: string;
    encryptedPrivateKey: string;
    salt: string;
  }) =>
    request<{
      token: string;
      user: { id: string; username: string; publicKey: string; createdAt: string };
      encryptedPrivateKey: string;
      salt: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    request<{
      token: string;
      user: { id: string; username: string; publicKey: string; createdAt: string };
      encryptedPrivateKey: string;
      salt: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Users
export const users = {
  getUser: (id: string) =>
    request<{ id: string; username: string; publicKey: string; createdAt: string }>(
      `/api/users/${id}`
    ),

  searchUsers: (q: string) =>
    request<Array<{ id: string; username: string; publicKey: string; createdAt: string }>>(
      `/api/users/search?q=${encodeURIComponent(q)}`
    ),
};

// Servers
export const servers = {
  list: () =>
    request<
      Array<{
        id: string;
        name: string;
        ownerId: string;
        createdAt: string;
        memberCount: number;
        channels: Array<{ id: string; name: string; serverId: string; type: string; createdAt: string }>;
      }>
    >('/api/servers'),

  create: (name: string, encryptedChannelKey?: string) =>
    request<{
      id: string;
      name: string;
      ownerId: string;
      createdAt: string;
      channels: Array<{ id: string; name: string; serverId: string; type: string; createdAt: string }>;
    }>('/api/servers', {
      method: 'POST',
      body: JSON.stringify({ name, encryptedChannelKey }),
    }),

  join: (serverId: string) =>
    request<{
      id: string;
      name: string;
      ownerId: string;
      createdAt: string;
      channels: Array<{ id: string; name: string; serverId: string; type: string; createdAt: string }>;
      alreadyMember: boolean;
    }>(`/api/servers/${serverId}/join`, {
      method: 'POST',
    }),

  getMembers: (serverId: string) =>
    request<
      Array<{
        id: string;
        userId: string;
        serverId: string;
        role: string;
        encryptedKeys: string;
        user: { id: string; username: string; publicKey: string };
      }>
    >(`/api/servers/${serverId}/members`),

  updateMemberKeys: (serverId: string, userId: string, encryptedKeys: string) =>
    request<{ encryptedKeys: string }>(
      `/api/servers/${serverId}/members/${userId}/keys`,
      {
        method: 'POST',
        body: JSON.stringify({ encryptedKeys }),
      }
    ),

  updateMyKeys: (serverId: string, encryptedKeys: string) =>
    request<{ encryptedKeys: string }>(
      `/api/servers/${serverId}/members/keys`,
      {
        method: 'POST',
        body: JSON.stringify({ encryptedKeys }),
      }
    ),
};

// Channels
export const channels = {
  list: (serverId: string) =>
    request<Array<{ id: string; name: string; serverId: string; type: string; createdAt: string }>>(
      `/api/servers/${serverId}/channels`
    ),

  create: (serverId: string, name: string, encryptedChannelKey?: string) =>
    request<{ id: string; name: string; serverId: string; type: string; createdAt: string }>(
      `/api/servers/${serverId}/channels`,
      {
        method: 'POST',
        body: JSON.stringify({ name, encryptedChannelKey }),
      }
    ),

  getMyKeys: (serverId: string) =>
    request<{ encryptedKeys: string }>(`/api/servers/${serverId}/members/me/keys`),
};

// Messages
export const messages = {
  list: (channelId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<
      Array<{
        id: string;
        ciphertext: string;
        nonce: string;
        channelId: string;
        senderId: string;
        sender: { id: string; username: string; publicKey: string };
        createdAt: string;
      }>
    >(`/api/channels/${channelId}/messages${query}`);
  },

  send: (channelId: string, data: { ciphertext: string; nonce: string }) =>
    request<{
      id: string;
      ciphertext: string;
      nonce: string;
      channelId: string;
      senderId: string;
      createdAt: string;
    }>(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// DMs
export const dm = {
  list: (userId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<
      Array<{
        id: string;
        ciphertext: string;
        nonce: string;
        senderId: string;
        recipientId: string;
        sender: { id: string; username: string; publicKey: string };
        createdAt: string;
      }>
    >(`/api/dm/${userId}/messages${query}`);
  },

  send: (userId: string, data: { ciphertext: string; nonce: string }) =>
    request<{
      id: string;
      ciphertext: string;
      nonce: string;
      senderId: string;
      recipientId: string;
      createdAt: string;
    }>(`/api/dm/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
