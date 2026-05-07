# CLAUDE.md — WRLD App

This file is read by Claude Code at the start of every session. It captures
project context, architectural decisions, and conventions so any Claude
instance working in this repo is immediately oriented.

> **Human collaborators:** Ben (Mac, founder/dev) and Aaron (Windows, founder/dev).
> Two-person team building WRLD's alpha.

> **Sister repos:**
>
> - `wrld-backend` (Fastify API + Postgres + Caddy in Docker on the
>   Hetzner box). Shares Clerk for auth and the API contract documented
>   in `wrld-backend/docs/API.md`.
> - `wrld-mediasoup` (mediasoup signaling server, runs natively on the
>   same Hetzner box as a systemd service). The app connects to it over
>   WSS for signaling and over WebRTC for media.

---

## What WRLD is

A live-streaming platform with a unique twist: users broadcast their current
real-world experience, and viewers can hop between nearby phones to see the
same event from multiple angles. Think "live event with multi-angle camera
switching, but the cameras are other people's phones."

The North Star UX:

1. Open the app → see a 3D globe with pins for live streams nearby
2. Tap a pin → join the stream
3. While watching, see "other angles available" → swipe to a different streamer at the same event
4. Or: hit the dashboard, arm your stream layers, go live yourself

---

## Architecture (decided)

```
[wrld-app: React Native + Expo Router]
        │
        ├── Auth: Clerk (hosted, JWT, no AWS)
        │
        ├── HTTPS  ──▶ api.wrld.cam   ─┐
        ├── WSS    ──▶ media.wrld.cam ─┤── single Hetzner box (5.78.70.97)
        └── WebRTC ──▶ media.wrld.cam ─┘   ├── Caddy in Docker (TLS, reverse proxy)
                                            ├── Fastify API in Docker (api.wrld.cam)
                                            ├── Postgres + PostGIS in Docker
                                            └── mediasoup as systemd service on host
                                                (media.wrld.cam, ports :3001 + RTC)
```

**Key decisions:**

- **Three repos:** `wrld-app` (this one), `wrld-backend`, and `wrld-mediasoup`.
- **Auth: Clerk**, chosen over AWS Cognito (rough DX) and self-hosted
  Keycloak (ops burden). Clerk's React Native SDK handles signup/login UI,
  email verification, password reset out of the box. Free tier covers 10k MAUs.
- **Database: Postgres + PostGIS**, not DynamoDB. Multi-dimensional and
  geospatial queries dominate WRLD's workload.
- **API: Fastify on Hetzner**, not Lambda. Same box as mediasoup for alpha.
- **mediasoup runs natively on the host**, not in Docker. RTC port handling
  and `ANNOUNCED_IP` semantics are simpler that way. The Caddy container
  reaches it via the Docker compose-network gateway IP — see wrld-backend's
  CLAUDE.md (Chunk 3a section) for the gnarly networking details.
- **ORM: Prisma** (Ben/Aaron familiar).
- **Stream lifecycle source of truth: mediasoup → API webhooks** (Option B).
  When mediasoup says a producer started, we write the Stream row. Heartbeats
  every 30s; reaper job marks stale rows `isLive=false` if heartbeats stop.
- **Long-term provider mix:** Hetzner for media + API + DB (cheap egress —
  critical for streaming). Clerk for auth. AWS or Cloudflare for utility
  services (S3-compatible storage, CDN, push) when those phases come.

---

## Repo conventions

### Stack

- React Native via **Expo SDK 54** (managed workflow for Phases 1–6; custom
  dev client introduced in Phase 7 for `react-native-webrtc`)
- **Expo Router** (file-based) for navigation
- **TypeScript strict** everywhere
- **Zustand** for client state (will become thinner once Clerk's hooks handle
  auth state directly)
- **TanStack Query** for server state
- **Axios** for HTTP
- **Clerk** (`@clerk/clerk-expo`) for auth — added in Phase 3
- React 19 / RN 0.81

### Folder layout

```
app/                       # Expo Router routes (file = route)
├── _layout.tsx           # Root: providers (ClerkProvider, QueryClient, SafeArea)
├── index.tsx             # Auth-aware redirect
├── (auth)/               # Logged-out group
│   ├── login.tsx
│   └── signup.tsx
└── (app)/                # Logged-in group (tabs)
    ├── globe.tsx         # Phase 5: 3D globe of live streams (expo-gl + three)
    ├── dashboard.tsx     # Phase 6: layer arming
    └── stream/[id].tsx   # Phase 7: creator + viewer stream views

src/
├── api/                  # Axios client + endpoint modules per resource
├── components/
│   ├── ui/               # Primitives (Button, Input, ...)
│   └── feature/          # Feature-specific components
├── features/             # Feature modules (auth, streams, ...)
├── hooks/                # Custom React hooks
├── lib/                  # env loader, theme tokens, utilities
├── stores/               # Zustand stores
└── types/                # Shared types
```

### Code style

- **No semicolons**, single quotes, trailing commas (see `.prettierrc`)
- **2-space indent**, LF line endings (see `.editorconfig` + `.gitattributes`)
- **Path aliases:** import from `@/...` instead of relative paths.
  `metro.config.js` resolves `@/foo` → `src/foo` at runtime.
- **Exact case in imports** (Mac is case-insensitive, CI is not)
- **Arrow functions for components**, named exports
- **One screen per file** in `app/`

### Cross-platform discipline

Aaron is on Windows. To avoid breakage:

- Never use `\n` style paths or platform-specific shell features in scripts
- Line endings are enforced LF via `.gitattributes`
- Commands in docs use POSIX-compatible syntax; Windows users use Git Bash
  or PowerShell with the same commands where possible

### Ben's specific environment notes

- 2017 Intel MacBook Pro on macOS Ventura 13.7.8 (cannot upgrade past Ventura)
- Metro requires the lean dep tree + `metro.config.js` blocklists to avoid
  EMFILE on file-descriptor-constrained macOS. **Don't add deps without
  considering watched file count.** Add per-phase as needed, not preemptively.
- npm cache and `/usr/local/lib/node_modules` should remain owned by the user
  (`appix`). If you ever see "permission denied" on `rm -rf node_modules`, run
  `sudo chown -R $(whoami) ~/.npm /usr/local/lib/node_modules /usr/local/share /usr/local/bin`
  rather than reaching for sudo on npm itself.

---

## Phased build plan

We're building in slices so each phase is independently verifiable.

| Phase | Status   | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | ✅ done  | Dev environment, Expo Router scaffold, auth/dashboard/stream placeholder screens, Zustand auth store, axios client, theme + UI primitives. Verified end-to-end on Ben's iPhone via Expo Go.                                                                                                                                                                                                                                                                                            |
| 2     | ✅ done  | Backend infrastructure. Chunk 1 ✅ (local backend dev), Chunk 2 ✅ (Hetzner deploy live at api.wrld.cam, end-to-end signup verified), Chunk 3a ✅ (mediasoup signaling server live at media.wrld.cam, 5 lifecycle calls wired).                                                                                                                                                                                                                                                        |
| 3     | next     | App-side integration: real Clerk signup/login via `@clerk/clerk-expo` (replace Phase 1 stubs, axios interceptor pulls Clerk session token), AND the wrld-app side of mediasoup wiring (originally tracked as "Chunk 3b" in the backend session — connecting to wss://media.wrld.cam, joining/leaving stream rooms, basic test of API call cadence). Note that Phase 7 is where heavy WebRTC client logic lives; Phase 3 is just enough mediasoup-client to verify the full path works. |
| 4     | upcoming | App calls `GET /streams/near` for the globe; "go live" flow that connects to mediasoup with location                                                                                                                                                                                                                                                                                                                                                                                   |
| 5     | upcoming | 3D globe via `expo-gl` + `three.js`; pins from streams API; tap → stream view                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6     | upcoming | Dashboard with stream layer arming (audio/video/overlays/chat — exact "layer" semantics TBD)                                                                                                                                                                                                                                                                                                                                                                                           |
| 7     | upcoming | Custom dev client; full mediasoup-client integration; creator broadcast view; viewer consumption view; multi-angle hop UX                                                                                                                                                                                                                                                                                                                                                              |

When Claude Code is asked to "do the next phase," verify the user means the
next unstarted phase above and ask before scaffolding multiple phases at once.

> **Phase 3 ↔ Chunk 3b naming note:** The backend session split Phase 2 into
> Chunk 1 (local), Chunk 2 (deploy), Chunk 3a (mediasoup server), and Chunk 3b
> (mediasoup client in the app). What was called "Chunk 3b" in those
> conversations is part of Phase 3 here. Same work, different naming convention.

---

## How to run things (cheat sheet)

```bash
# Start the app (dev)
npx expo start

# Type check
npx tsc --noEmit
```

Production endpoints to point the app at:

- API: `https://api.wrld.cam`
- Mediasoup signaling: `wss://media.wrld.cam`

Both go in `.env` under `EXPO_PUBLIC_*` keys (see "Backend repos" below).

---

## Backend repos (separate)

The API + Postgres + Caddy live in `wrld-backend`, deployed via Docker
Compose to a Hetzner box at `5.78.70.97`. The mediasoup signaling server
lives in `wrld-mediasoup`, deployed as a host-side systemd service on the
same box. See each repo's `CLAUDE.md` for ops detail.

This app's `.env`:

- `EXPO_PUBLIC_API_BASE_URL=https://api.wrld.cam`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...` (added in Phase 3)
- `EXPO_PUBLIC_MEDIASOUP_WSS_URL=wss://media.wrld.cam` (added in Phase 3)

---

## Working style

Ben and Aaron prefer:

- **Iterative, version-controlled progress** — small commits, named phases,
  each phase verifiable before the next.
- **Decisions surfaced before code** — if there's a tradeoff, name it; don't
  silently pick one path.
- **Step-by-step practical guidance** — they ask clarifying questions that
  meaningfully shape outputs; treat clarifying questions back to them as
  welcome rather than friction.
- **No surprise scope creep** — if a request implies more than what was
  asked, say so and confirm.

When in doubt, ask before assuming.

---

## What NOT to do

- **Don't switch the database.** PostGIS was a deliberate choice over
  DynamoDB; revisiting requires explicit human decision.
- **Don't switch auth providers.** Clerk was chosen deliberately over Cognito
  and Keycloak; revisiting requires explicit human decision.
- **Don't add Redis "just in case."** The two-user alpha doesn't need it.
- **Don't add new state libraries.** Zustand + TanStack Query covers the app.
- **Don't refactor working code without being asked.** New features only.
- **Don't bypass the phase plan.** If asked for Phase 5 work while Phase 3
  isn't done, ask whether to skip ahead or finish in order.
- **Don't preemptively add dependencies.** Ben's machine has tight file
  descriptor limits. Add deps as their phases need them, not in advance.
- **Don't put `CLERK_SECRET_KEY` (`sk_...`) anywhere in this repo.** Only the
  publishable key (`pk_...`) belongs in this codebase.
- **Don't put `INTERNAL_API_SECRET` anywhere in this repo.** That's the
  shared secret between mediasoup and the API, server-to-server only. The
  app never holds it. The app authenticates via Clerk JWT to the API and
  via Clerk JWT to the mediasoup signaling server.
