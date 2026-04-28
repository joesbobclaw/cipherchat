# CipherChat

> ⚠️ **Good app skeleton, wrong security core.** Spec is Phase-0 complete (`docs/architecture.md`). Crypto/auth/schema need rebuilding to match it before this is a real secure messenger. This is Phase 0 infrastructure. The spec in `docs/architecture.md` is the source of truth. The code does not yet match the spec. Phase 1 brings the code up to the spec — especially the crypto and device model.

A privacy-first Discord alternative. E2EE by default for all message content. Content private, metadata reduced where practical, not magically eliminated.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS |
| Backend | Fastify (HTTP :4000) + `ws` WebSocket server (:4001) |
| Database | PostgreSQL 16 via Prisma ORM |
| Encryption | tweetnacl (X25519 + XSalsa20-Poly1305) |
| Auth | JWT sessions + X25519 keypairs as user identity |

## Monorepo Structure

```
cipherchat/
  packages/
    shared/    # Crypto utilities + TypeScript types
    server/    # Fastify API + WebSocket server
    client/    # Next.js 14 app
  docker-compose.yml
  package.json
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.local.example packages/client/.env.local
```

Edit `packages/server/.env` and change `JWT_SECRET` before deploying to production.

### 3. Start PostgreSQL

```bash
docker-compose up -d
```

### 4. Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

When prompted for a migration name, enter: `init`

### 5. Start development servers

```bash
npm run dev
```

- Client: http://localhost:3000
- Server API: http://localhost:4000
- WebSocket: ws://localhost:4001

---

## Encryption Model

### User Identity

Every user has an X25519 keypair generated in-browser at registration using tweetnacl:

```
generateKeyPair() -> { publicKey: Uint8Array, secretKey: Uint8Array }
```

- **Public key** stored on the server. Used by others to encrypt messages to you.
- **Private key** encrypted with your password (PBKDF2 + AES-GCM), stored as ciphertext on the server. The server never sees the plaintext private key.

### Password-Based Key Protection

```
PBKDF2(password, randomSalt, 100_000 iterations, SHA-256) -> 256-bit AES key
AES-GCM(privateKey, aesKey, randomIV) -> encryptedPrivateKey
```

The encrypted private key is stored server-side and in localStorage. On login it is decrypted client-side using your password and held only in memory (Zustand store, never re-persisted).

### Direct Messages (DMs)

Uses X25519 ECDH key agreement + XSalsa20-Poly1305 authenticated encryption:

```
nacl.box(message, nonce, recipientPublicKey, senderSecretKey)
```

The server stores: `ciphertext`, `nonce`, `senderId`, `recipientId`, `createdAt`. Nothing else.

### Channel Messages (Group)

Each channel has a symmetric 256-bit key generated client-side:

```
channelKey = nacl.randomBytes(32)
```

To send a message:

```
nacl.secretbox(message, nonce, channelKey)
```

Channel keys are encrypted per-member using their public key and stored in `ServerMember.encryptedKeys`. When a new member joins, an online admin re-encrypts channel keys for them using the "Share Keys" button in the member list.

### What the Server Sees

| Data | Server Access |
|---|---|
| Message content | Ciphertext only |
| Private keys | Encrypted blob only |
| Who talks to whom | User IDs + timestamps |
| Channel membership | User IDs |
| Public keys | Yes (required for key exchange) |

---

## API Reference

```
POST /api/auth/register
POST /api/auth/login

GET  /api/users/:id
GET  /api/users/search?q=

POST /api/servers
GET  /api/servers
POST /api/servers/:id/join
GET  /api/servers/:id/members
POST /api/servers/:sid/members/keys         -- update your own encrypted channel keys
GET  /api/servers/:sid/members/me/keys      -- get your encrypted channel keys
POST /api/servers/:sid/members/:uid/keys    -- admin: push keys to a member

POST /api/servers/:sid/channels
GET  /api/servers/:sid/channels

GET  /api/channels/:id/messages?before=&limit=
POST /api/channels/:id/messages             -- { ciphertext, nonce }

GET  /api/dm/:userId/messages
POST /api/dm/:userId                        -- { ciphertext, nonce }
```

## WebSocket Events

```
Client -> Server:
  authenticate      { token }
  subscribe_channel { channelId }
  subscribe_dm      { userId }

Server -> Client:
  new_message   { id, channelId, senderId, ciphertext, nonce, createdAt, senderUsername }
  new_dm        { id, senderId, recipientId, ciphertext, nonce, createdAt, senderUsername }
  user_presence { userId, online }
  user_joined   { serverId, userId, username }
```

---

## Key Distribution Flow

1. User A joins a server via POST `/api/servers/:id/join`
2. Server adds them as a member with empty `encryptedKeys`
3. An online admin sees User A in the member list with a "Share Keys" button
4. Admin clicks it: client fetches User A's public key, re-encrypts each channel key for them
5. Encrypted keys are POSTed to `/api/servers/:sid/members/:uid/keys`
6. User A's next load fetches their encrypted keys and decrypts with their private key

---

## Development

```bash
# Backend only
npm run dev --workspace=packages/server

# Frontend only
npm run dev --workspace=packages/client

# Prisma Studio (DB browser)
cd packages/server && npx prisma studio

# Reset database
cd packages/server && npx prisma migrate reset
```
