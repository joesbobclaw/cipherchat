# CipherChat — Architecture & Design Spec
*Consolidated from Bob + Skippy design session, 2026-04-28*

> **Scaffold status:** Good scaffold, pre-spec cryptosystem. The code is a starting point, not a finished security implementation. Phase 1 aligns the code to this doc before shipping anything to users.

## Project
Privacy-first Discord alternative. Discord-style UX, E2EE by default for all message content.
**V1 default: invite-only workspaces.** No open registration, no public servers. Reduces spam/abuse surface while the moderation story is still immature.

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

**First-class models:**
- `User` — account identity, username
- `Device` — per-device identity public key, trust state
- `SignedPrekey` — rotated signed prekey per device
- `OneTimePrekey` — consumed on session init, deleted after use
- `Workspace` — invite-only by default in V1
- `Channel` — text channels within a workspace
- `ChannelMember` — membership, encrypted sender key per member
- `EncryptedMessageEnvelope` — ciphertext + nonce only, no plaintext
- `Attachment` — encrypted file reference
- `AttachmentKeyRef` — per-recipient encrypted attachment key distribution
- `Session` — short-lived auth capability (JWT backing store if needed)
- `DeviceTrustState` — trusted / known / unknown per device pair
- Audit tables (optional) — key changes, device additions, revocations

**Also stores:** workspace/channel membership, permissions, invites, roles, delivery receipts, queue state

> Prekey bundles are first-class server objects. Without them, async DM session setup (X3DH) requires both parties online simultaneously — the moon-alignment problem. Server holds bundles, distributes one-time prekeys on demand, and deletes consumed keys immediately.

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
- Invite-only workspaces
- Text channels
- DMs (X3DH + Double Ratchet)
- Small encrypted group chats/channels with Sender Keys (**hard cap: 100 members; preferred default: 50**)
- Per-device identity keys
- Pairwise DM session bootstrap with prekey bundles
- Client-side encrypted attachments
- WebSocket real-time delivery
- Local-only search over decrypted content
- Basic roles/permissions
- **Device fingerprint display** (your own devices + contacts' devices)
- **User/profile key fingerprint display** (visible on every profile)
- **"New device added" visibility** (alert when a contact's device list changes)
  > Without key inspection, users are trusting vibes with extra math. That's not a security product.
- QR device linking
- Device trust states: trusted / known / unknown
- Honest onboarding copy about metadata exposure and recovery limits
- Recovery phrase / encrypted key backup (basic)
- Docker/dev setup
- Clear "🔒 end-to-end encrypted" UI indicators

## V1 Hard No
- Voice/video
- Large public communities
- Bots / app platform
- Federation / Matrix compatibility
- Perfect metadata hiding
- Server-side content search
- Polished recovery beyond recovery phrase basics
- Message history sharing with newly added members
- Advanced moderation tooling over encrypted content
- Hard-block verification workflows

## Important V1 Constraints
- Keep encrypted groups/channels **small** — hard cap enforced, not aspirational
- **Rotate channel/group keys on every membership change** — no exceptions
- Abuse reporting = **client-side voluntary re-encryption** to moderation key, explicit user consent
- Store **ciphertext envelopes**, never plaintext messages
- Server is **content-blind, not metadata-blind** — say this plainly everywhere

## UX Truths (must be stated plainly in product)
- **Lose your recovery phrase = lose old encrypted history on a new device.** No support escape hatch.
- **Unverified devices are visible and nudged, not silently trusted.** Nudge, don't hard-block.
- **This product protects message content more than metadata.** Don't oversell it.

> A real MVP, not a hallucinated empire.
> Code can be regenerated. Protocol mistakes become archaeology.

## Official Roadmap

**Phase 0** ✅ — docs, threat model, architecture, protocol boundaries

**Phase 1** — working MVP for encrypted text collaboration
- Auth + per-device keys + prekey bundles
- DMs (X3DH + Double Ratchet)
- Group channels (Sender Keys, hard cap 50–100)
- Encrypted attachments
- WebSocket delivery
- Fingerprint display + device trust states
- Invite-only workspaces + basic roles
- Local search

**Phase 2** — operational polish
- Recovery UX hardening
- Moderation/abuse reporting flows
- Reactions + threads
- Multi-device hardening + QR device linking
- Push notifications
- Mobile clients (React Native / Expo)

**Phase 3** — scale + interop
- MLS migration path for larger/dynamic channels
- Voice/video with SFrame over SFU
- Improved verification UX (full QR/safety-number ceremony)
- Key transparency / auditable key directory
- Self-hosted one-click install
- Selective federation/interoperability — only if it still looks worth the pain

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

### Joe-facing summary
- **Metadata exposure:** who talks to whom, when, and how often
- **Membership exposure:** which users are in which spaces/channels
- **Traffic analysis:** activity bursts and fetch patterns
- **Key-distribution trust:** mitigated in V1 with fingerprint display; improved in V2 with QR/safety-number verification
- **Device compromise:** out of scope — owned client means owned plaintext

### Full model
**Protects against:**
- Server compromise
- Operator access to stored chat data
- Database leaks
- Attachment storage compromise

**Still exposed / partially exposed:**
- Social graph — who talks to whom
- Membership graph — which users are in which workspaces/channels
- Timing metadata — when messages are sent, activity bursts, read/delivery timing
- Presence metadata — online state, typing indicators unless explicitly hidden/blurred
- Attachment metadata — size, count, upload/download timing, MIME hints unless padded
- Abuse/report metadata — who reported whom, and when
- Device/account metadata — device additions, revocations, recovery events
- Network metadata — IP addresses unless proxying/relays added
- Access-pattern leakage — what gets fetched and when

> Content secrecy is tractable. Metadata secrecy is where the gods demand sacrifices.
> Be explicit with users: this system protects what you *say*, not the fact that you said it, to whom, or when.

**Sender Keys compromise window (explicit):**
> **Sender Keys trade forward secrecy and post-compromise security for implementation simplicity and group scalability in V1. If a member device is compromised, stored ciphertext from that sender may be decryptable beyond the ideal security window. CipherChat accepts this tradeoff for small-group MVP channels and plans MLS for stronger group security in a later phase.**

Mitigations: aggressive key rotation on membership changes, hard group size cap enforced. Full post-compromise security requires MLS (V2). This limitation must be in user-facing security docs, not buried in footnotes.

**Out of scope:**
- Device compromise (if your device is owned, all bets are off)
- Traffic analysis / timing attacks (future problem)

---

## Security Notes
- **E2EE in a browser is only as trustworthy as the runtime delivering the decrypted plaintext.** IndexedDB is storage, not a secure enclave. Web Crypto protects operations, not a compromised runtime. XSS or a malicious extension can expose plaintext, steal unlocked key material, or tamper with key verification UI.
- Mitigations: strict CSP, Subresource Integrity on all assets, zero third-party scripts in crypto path
- Native app (Electron/React Native) eliminates XSS attack surface — reason to prioritize mobile V2
- **PBKDF2 vs Argon2id tradeoff for Joe:** Argon2id is the stronger password-hardening choice but browser delivery means WASM + more bundle/supply-chain surface. PBKDF2 via native Web Crypto is weaker but simpler, more auditable, and operationally cleaner for a browser-first MVP. Decision: start with PBKDF2 at 600k+ iterations, migrate to Argon2id when native clients ship.
- Abuse reporting: client-side re-encryption to moderation key, explicit user consent flow
- No fake promises: metadata limits explained plainly in onboarding, not buried in privacy policy
