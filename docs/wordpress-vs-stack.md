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

> **WordPress gives you the lobby, not the vault, the radio system, or the blast doors.**
> If chat is a feature, WordPress helps. If encrypted chat is the product, WordPress is mostly furniture.

The vault is the same amount of work regardless of what you put in front of it. The CipherChat scaffold + spec is already built. Phase 1 starts whenever Joe says go.

---

## Alternative: Skip the custom build entirely

If the goal is "get off Discord fast with E2EE," **self-hosted Matrix/Element** is worth considering:
- E2EE by default, audited, proven
- Discord-like UI
- Self-hosted = you own the infra (portability ✅)
- Ships today, not in months
- Gives up: custom UX, latent space, Automattic ecosystem integration

CipherChat is the right long-term answer if you want full control and custom features. Matrix is the right answer if you want off Discord in a week.
