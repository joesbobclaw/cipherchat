# CipherChat — Architecture & Design Spec
*Consolidated from Bob + Skippy design session, 2026-04-28*

## Project
Privacy-first Discord alternative. Discord-style UX, E2EE by default for all message content.

## Non-negotiables
- Multi-device model from day one
- Key rotation on every membership change
- Attachments encrypted client-side before upload
- Presence/typing treated as metadata leaks — opt-in, coarse-grained only
- New members see history from join date only. No backdated access.

---

## Monorepo Structure
```
cipherchat/
  apps/
    web/          # React + TypeScript + Vite
    api/          # Node.js + Fastify
  packages/
    contracts/    # Shared types, API schemas
    crypto-core/  # Crypto interface + tweetnacl implementation (swappable)
    client-sdk/   # High-level client abstractions (reused by mobile)
  docs/
    architecture.md
    threat-model.md
    plan.md
```

---

## Crypto Model

### Identity
- Each **device** has its own keypair — device keys ARE identity
- JWTs are session tokens/capabilities only, issued after a **signed login challenge**
- JWT compromise = lose session (recoverable). Device key compromise = identity issue. Keep them separate.
- Server stores: public keys, prekey bundles. Never private keys.

### DMs — X3DH + Double Ratchet
- Initial session: X3DH key agreement (identity key + signed prekey + one-time prekey)
- Ongoing messages: Double Ratchet for forward secrecy + post-compromise security
- Server distributes prekey bundles; deletes one-time prekeys after use

### Group Channels — Sender Keys (V1)
> ⚠️ Groups are where the dragons live. Membership changes, rekeying, role changes, history access, and multi-device fanout are the hard parts. The Sender Keys approach below is the smallest safe thing that ships. Do not relax the size cap or rotation rules without a plan.
- Each channel has a symmetric Sender Key per member
- **Key rotates on every membership change** (join or leave)
- Small/medium groups only in V1 (hard cap: 100 members)
- Admin distributes new keys to remaining members encrypted to their device keys

### Group Channels — MLS RFC 9420 (V2)
- Migrate when channel sizes grow or membership churn makes Sender Keys painful
- MLS gives forward secrecy + post-compromise security at scale
- V2 also: SFrame over SFU for E2EE voice/video

### Attachments
- Encrypted client-side with a per-file symmetric key before upload
- File key encrypted to recipient(s) alongside the message envelope
- Server stores: ciphertext blob + encrypted file key reference. Never plaintext.

### Key Protection (local)
- Private keys encrypted with user password before IndexedDB storage
- **Argon2id preferred** (RFC 9106) via WASM; PBKDF2 via Web Crypto acceptable with 600k+ iterations
- AES-GCM + HKDF via native Web Crypto API for symmetric operations
- tweetnacl for asymmetric primitives (X3DH, Double Ratchet) — behind `crypto-core` interface

### crypto-core Interface
- Nothing outside `packages/crypto-core` imports tweetnacl directly
- Define `ICryptoProvider` interface first; implement with tweetnacl
- Swap to libsignal or MLS implementation later without touching app code

---

## Auth Flow
1. Client generates device keypair on registration
2. Server issues a **signed challenge**
3. Client signs challenge with device private key
4. Server verifies signature, issues short-lived JWT
5. JWT used for API calls only — never as identity root of trust

---

## Data Model

### Server stores
- Accounts (username, public key bundle)
- Devices (per-device public keys, prekey bundles)
- Workspace/channel membership
- Encrypted message envelopes (ciphertext + nonce only)
- Encrypted attachment references
- Permissions, invites, roles
- Delivery receipts / queue state

### Client stores (IndexedDB)
- Decrypted message cache
- Local search index (over decrypted content only)
- Key material (encrypted at rest)
- Device trust state (trusted / known / unknown)

---

## What the Server Sees
| Sees | Does not see |
|------|-------------|
| Who talks to whom | Message content |
| Channel membership | File contents |
| Timestamps | Private keys |
| Attachment sizes | Search queries |
| Delivery state | Typing targets (if feature disabled) |
| Public keys | |

**Framing:** Ciphertext-only server for content. Metadata-minimizing where practical, not magically eliminated.

---

## V1 Scope (Ship)
- User registration + per-device keys
- Signed login challenge → JWT session
- DMs (X3DH + Double Ratchet)
- Small encrypted group channels with Sender Keys (hard cap: 100 members)
- Encrypted attachments
- Invites + roles
- WebSocket real-time delivery
- Local-only search over decrypted content
- Basic presence (opt-in, coarse-grained)
- QR device linking
- Safety-number style device verification UI
- Recovery phrase / encrypted key backup (optional)
- Clear "🔒 end-to-end encrypted" UI indicators
- Honest metadata disclosure in onboarding

## V1 Hard No
- Large public servers
- Voice/video
- Bots/marketplace
- Message history sharing with newly added members
- Rich moderation over encrypted content
- Federation

## V2
- Mobile (React Native / Expo) using packages/client-sdk
- Push notifications
- MLS migration for larger/dynamic channels
- SFrame over SFU for voice/video E2EE
- Better moderation flows
- Recovery UX improvements

## V3
- Federation
- Advanced moderation tooling
- Large public community support
- Bots/apps marketplace

---

## Tech Stack
| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Fastify |
| Database | PostgreSQL (durable metadata) |
| Cache/fanout | Redis (presence, queues, fanout) |
| Real-time | WebSockets |
| Crypto (V1) | tweetnacl behind crypto-core interface |
| Crypto (V2) | libsignal / MLS via same interface |
| Key storage | IndexedDB + Web Crypto (AES-GCM) |
| Mobile (V2) | React Native / Expo |

---

## Threat Model (summary)
**Protects against:**
- Server compromise
- Operator access to stored chat data
- Database leaks
- Attachment storage compromise

**Still exposed / partially exposed:**
- Social graph (who talks to whom)
- Room membership metadata
- Timestamps
- Presence patterns
- Attachment sizes
- Abuse-reporting tension with E2EE (mitigated by client-side re-encryption flow)

**Out of scope:**
- Device compromise (if your device is owned, all bets are off)
- Traffic analysis / timing attacks (future problem)

---

## Security Notes
- Browser-first: keys in IndexedDB are only as safe as the client runtime
- Mitigations: strict CSP, Subresource Integrity on all assets, zero third-party scripts in crypto path
- Native app (Electron/React Native) eliminates XSS attack surface — reason to prioritize mobile V2
- Abuse reporting: client-side re-encryption to moderation key, explicit user consent flow
- No fake promises: metadata limits explained plainly in onboarding, not buried in privacy policy
