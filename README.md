# CipherChat

> ⚠️ **Good scaffold. Wrong security core.** This is Phase 0 infrastructure. See `docs/architecture.md` for the canonical spec. The code does not yet match the spec — Phase 1 brings it into alignment.

A privacy-first Discord alternative. E2EE by default for all message content. Content private, metadata reduced where practical, not magically eliminated.

---

## Status

| Layer | State |
|-------|-------|
| Spec (`docs/architecture.md`) | ✅ Phase 0 complete — canonical |
| Scaffold (server, client, schema) | ✅ Present — pre-spec crypto/auth |
| Crypto (X3DH, Double Ratchet, Sender Keys) | ❌ Not yet implemented |
| Schema (Device, prekeys, attachments) | ❌ Not yet implemented |
| Auth (signed challenge flow) | ❌ Not yet implemented |

---

## Docs

- [`docs/architecture.md`](docs/architecture.md) — canonical spec, threat model, roadmap
- [`docs/phase1-kickoff.md`](docs/phase1-kickoff.md) — audit findings, Phase 1 work order

---

## Stack (target)

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Fastify + WebSockets |
| Database | PostgreSQL + Prisma |
| Cache/fanout | Redis |
| Crypto (V1) | tweetnacl behind `ICryptoProvider` interface |
| Key storage | IndexedDB + Web Crypto (AES-GCM) |

---

## Phase 1 Work Order

1. Restructure to `apps/web`, `apps/api`, `packages/contracts`, `packages/crypto-core`, `packages/client-sdk`
2. Add `Device` + prekey tables + attachment model to schema
3. Define `ICryptoProvider` interface before touching crypto
4. Replace DM crypto: X3DH + Double Ratchet
5. Replace auth: signed challenge → short-lived JWT
6. Sender Keys with mandatory rotation for group channels

See [`docs/phase1-kickoff.md`](docs/phase1-kickoff.md) for the full ordered list.

---

## Quick Start (scaffold only — not for production use)

```bash
npm install
cp packages/server/.env.example packages/server/.env
docker-compose up -d
npm run db:generate && npm run db:migrate
npm run dev
```
