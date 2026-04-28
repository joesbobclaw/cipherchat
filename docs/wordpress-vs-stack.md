# WordPress vs Dedicated Stack — Decision Memo
*Bob + Skippy, 2026-04-28*

## Joe's Goals
1. **Privacy** — no operator/third-party access to message content
2. **Portability** — not dependent on Discord; own the infrastructure
3. **Latent space** — future data utility, AI workflows, unknown uses

---

## What WordPress gives you for free (~20-30% of the work)
- User accounts, auth, roles, sessions, nonces
- Admin UI and moderation surfaces
- Media uploads / library
- REST API scaffolding and response shaping
- Invite/code management
- Notifications and email plumbing
- Search over server-visible data
- Multisite-ish tenancy patterns
- Something Joe already knows deeply

## What WordPress does NOT give you (~70-80% of the work)
Everything product-defining for an encrypted messenger:
- Real-time chat architecture (WebSockets, presence, fanout)
- Per-device identity keys
- Prekey bundles / X3DH session bootstrap
- Double Ratchet for DM forward secrecy
- Sender Keys + group rekey lifecycle
- Encrypted attachment key distribution
- Device trust / fingerprint verification UX
- Local encrypted client-side search
- Metadata-minimizing message envelopes
- Redis fanout layer
- Anything about the actual security model

**WordPress Heartbeat is polling, not WebSockets.** Not suitable as the realtime layer for Discord-like chat.

---

## You Have Two Product Ideas, Not One (Skippy)

**Option A — CipherChat**
- Goal: nobody but participants can read message content; self-hosted; portable; server-blind to transcripts
- Tradeoff: latent space over message content is mostly gone server-side; future AI/search/analytics over content must be client-side, opt-in, or explicitly re-encrypted/shared

**Option B — WordPress-native community system**
- Goal: portable, self-hosted, flexible, searchable, mineable; easier integration with publishing/community/admin workflows
- Tradeoff: server can read transcripts; privacy promise is much weaker; not the same thing as an encrypted Discord alternative

> **If privacy is the main thing, WordPress is not the engine.**
> **If data utility is the main thing, CipherChat's E2EE model works against that on purpose.**
> Don't ask one system to promise both "the server can't read this" and "the server can later mine this." Those are not friends.
> WordPress wins for latent space only if the messages stay readable to the server. If you make them properly E2EE, WordPress just stores elegant garbage blobs.

If you want both: build CipherChat for private conversation; keep WordPress as the place where intentionally-public or intentionally-shareable knowledge gets published, summarized, indexed, and reused.

---

## The E2EE / Latent Space Tension

Joe's use cases are partially in conflict:

| Goal | E2EE | "I own the server" |
|------|------|-------------------|
| Discord can't read my chats | ✅ Solves it | ✅ Solves it |
| Breach can't leak history | ✅ Solves it | ❌ Breach = leak |
| Future AI/data workflows | ❌ Encrypted = unusable | ✅ Full access |

**You can't have both E2EE and server-side data utility on the same messages.** Pick one, or accept that AI workflows operate only on metadata.

---

## Recommendation

**Use WordPress as the shell:**
- Marketing site / docs
- Account + invite management
- Admin / moderation backoffice
- Maybe billing / org management

**Use the Node/Fastify stack as the runtime:**
- Encrypted messaging core
- WebSockets / Redis / real-time layer
- Crypto protocol (X3DH, Double Ratchet, Sender Keys)
- All the hard security work

> **WordPress helps with portability and operations. It does not give you privacy for free.**
> If E2EE chat is the product, WP should be the lobby, not the vault.
> If chat is a feature, WordPress helps. If encrypted chat is the product, WordPress is mostly furniture.

The vault is the same amount of work regardless of what you put in front of it. The CipherChat scaffold + spec is already built. Phase 1 starts whenever Joe says go.

---

## Decision Framework for Joe's Threat Model

**Your stated threats:**
1. Don't want Discord/hosted provider reading chats
2. Don't want a breach leaking chat history

**Option ranking:**

| Option | Solves #1 | Solves #2 | Timeline |
|--------|-----------|-----------|----------|
| Matrix/Element (self-hosted) | ✅ | ✅ | Days |
| CipherChat (Phase 1+) | ✅ | ✅ | Months |
| WordPress + HTTPS | ✅ | ❌ | Days |

**Blunt recommendation:**
- Want something real **soon** → stand up Matrix/Element now
- Want something custom **later** → keep developing CipherChat
- WordPress + HTTPS solves only half your stated concern

> HTTPS is necessary but nowhere near sufficient for the threat you actually care about.

**The least romantic and most useful answer:**
> Deploy Matrix/Element now if you want protection soon.
> Keep CipherChat as the custom future if you decide the off-the-shelf answer isn't enough.

---

## Alternative: Skip the custom build entirely

If the goal is "get off Discord fast with E2EE," **self-hosted Matrix/Element** is worth considering:
- E2EE by default, audited, proven
- Discord-like UI
- Self-hosted = you own the infra (portability ✅)
- Ships today, not in months
- Gives up: custom UX, latent space, Automattic ecosystem integration

CipherChat is the right long-term answer if you want full control and custom features. Matrix is the right answer if you want off Discord in a week.
