# Make rate limits work behind a trusted proxy

## Problem

`buildApp` does not set Fastify's `trustProxy`. Behind an ingress, every client appears to share the proxy's IP address and therefore one rate-limit bucket.

## Scope

Add an optional `TRUSTED_PROXY` environment setting, validated in `parseEnvironment`, defaulting to no trust. Never trust forwarded headers by default, since a client could use them to evade limits.

## Acceptance criteria

- Tests show separate buckets with the setting on, and that forged `X-Forwarded-For` headers have no effect with it off.
- Documented in `docs/TESTNET_SETUP.md` and `.env.example`.
