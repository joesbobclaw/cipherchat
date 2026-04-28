# Phase 1 Kickoff — Audit Findings & Work Order
*Skippy paranoid pass, 2026-04-28*

## Verdict
**Production-inappropriate crypto, production-useful scaffold.**
This is a respectable place to land for a first pass. Do not ship the crypto. Do use the scaffold.

---

## Stop-Ship Gaps (must fix before any user-facing crypto claims)

| Gap | Impact |
|-----|--------|
| Static ECDH for DMs | No async session bootstrap, no forward secrecy, no post-compromise recovery |
| Single keypair on `User` | Multi-device, device revocation, trust-state UX all become retrofit surgery |
| No prekey bundles | Offline DM initiation is missing entirely |
| Direct `nacl` imports everywhere | Guaranteed pain when swapping implementations |
| PBKDF2 @ 100k iterations | Too low for stated threat model (needs 600k+ or Argon2id) |
| No attachment model | Messages encrypted, files quietly become the leak |

---

## Schema: Missing First-Class Models

- `Device` — per-device identity key, trust state
- `SignedPrekey` — rotated signed prekey per device
- `OneTimePrekey` — consumed on session init, deleted after use
- `Attachment` — encrypted file reference + key distribution
- `EncryptedMessageEnvelope` — explicit envelope metadata (vs raw ciphertext/nonce columns)

**Schema smell:** `encryptedKeys` as a JSON blob on `ServerMember` will become a swamp. Needs proper relational model.

---

## What's Worth Keeping

- Routing structure
- WebSocket layer
- Prisma setup and general shape
- App/server architecture
- Crypto utility code that is mechanically sound — move it behind `ICryptoProvider` interface

---

## Work Order for Phase 1 (in this order, no shortcuts)

1. **Freeze current crypto as non-canonical** — add comment headers to crypto files making clear they are pre-spec placeholders
2. **Restructure repo** to agreed monorepo layout:
   - `apps/api` (was `packages/server`)
   - `apps/web` (was `packages/client`, swap Next.js → Vite)
   - `packages/crypto-core` (was `packages/shared/src/crypto.ts`, add `ICryptoProvider`)
   - `packages/contracts` (shared types + API schemas)
   - `packages/client-sdk` (client-facing abstractions, reusable by mobile)
3. **Define `ICryptoProvider` interface first** — nothing implements crypto until the interface exists
4. **Fix schema** — add `Device`, `SignedPrekey`, `OneTimePrekey`, `Attachment`, proper envelope model; kill JSON blob on `ServerMember`
5. **Implement X3DH DM bootstrap** — prekey bundle fetch, session init, handshake storage
6. **Implement Double Ratchet** for ongoing DM message secrecy
7. **Implement Sender Keys** for group channels with mandatory rotation on membership change
8. **Replace auth flow** — signed challenge → JWT, not password-hash-first
9. **Bump PBKDF2 to 600k+ iterations** (or Argon2id via WASM when native clients ship)

---

## What Phase 1 Does NOT Touch
- Voice/video
- Large public communities  
- Federation
- MLS (that's Phase 3)
- Polished recovery UX (Phase 2)

---

*Do not touch crypto without adult supervision.*
