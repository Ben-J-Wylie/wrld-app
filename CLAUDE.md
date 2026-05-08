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
└── (app)/                # Logged-in + anonymous group (tabs)
    ├── globe.tsx         # Phase 4: nearby streams list (Phase 5: replace with 3D globe)
    ├── dashboard.tsx     # Go Live / Join controls (Phase 6: layer arming)
    └── stream/[id].tsx   # id=new → broadcaster; id=<roomId> → viewer (Phase 7: full WebRTC)

src/
├── api/                  # Axios client + endpoint modules per resource
├── components/
│   ├── ui/               # Primitives (Button, Input, ...)
│   └── feature/          # Feature-specific components
├── features/             # Feature modules (auth, streams, ...)
├── hooks/
│   └── useSignaling.ts   # React hook wrapping signalingClient (connect, createRoom, joinRoom)
├── lib/
│   ├── mediasoupSignaling.ts  # Typed WebSocket signaling client (singleton: signalingClient)
│   └── ...               # env loader, theme tokens, clerkToken, tokenCache
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
| 3     | ✅ done  | App-side mediasoup signaling (Expo Go, no native WebRTC yet). `src/lib/mediasoupSignaling.ts` — typed WebSocket client with promise-based protocol. `src/hooks/useSignaling.ts` — React hook managing connection/room state. `stream/[id].tsx` — broadcaster (id=new) and viewer (id=roomId) flows. Dashboard test controls (Go Live + room ID join). Verified end-to-end on Aaron's iPhone (broadcaster) and Ben's Android (viewer, room 7240) with wrld-backend receiving streamStarted. |
| 4     | ✅ done  | `expo-location` for GPS; `useLocation` + `useStreamsNear` hooks; `streamsApi.near()`; Go Live flow passes real title + coords to mediasoup; globe screen shows nearby stream cards (tap → join room). Fix: `streamStarted` moved to `createRoom` (not `produce`) so streams are discoverable before Phase 7 media. Fix: API port 3000 bound to loopback so mediasoup can reach it. Verified: Aaron streamed, Ben saw stream card on globe and joined. |
| 5     | ✅ done  | 3D globe via `expo-gl` + `three.js` + `expo-three`. `GLView` renders a Three.js scene: 8K textured earth sphere (Solar System Scope 8192×4096, bundled at `assets/images/earth.jpg`), `PanResponder` drag-to-spin + pinch-to-zoom (camera z 1.1–8), GPS auto-orient to user's location on first fix, auto-rotation when idle, red pins at each stream's lat/lng with constant screen size across zoom levels (per-pin depth scaling via `getWorldPosition`), raycaster tap-to-join. GL lifecycle hardened for Android context recreation: generation counter prevents stale async loops, renderer disposed on each `onContextCreate`, try/catch in animate self-cancels on GL surface loss. Metro `resolveRequest` intercept redirects `expo-three`'s loader imports to `stubs/threeLoaderStub.js` (null stubs for ColladaLoader etc.). Packages: `expo-gl`, `expo-location`, `expo-three`, `three` (`@types/three` removed — three ships its own types). |
| 6     | ✅ done  | Stream layer arming. Dashboard rebuilt: camera + audio layer toggle cards (tap to "ready"), title input, Go Live button (disabled until ≥1 layer + title + GPS). Tapping Go Live navigates to `stream/new` with `title` + `layers` as route params. `stream/[id].tsx`: broadcaster sees armed layers as active badges + live viewer count (pushed instantly via WebSocket `viewerCountUpdated`); viewer sees layer switcher built from the `layers` param passed by the globe on tap-to-join. Full stack: `Stream.layers String[]` column + migration; `POST /internal/streams/started` accepts layers; `GET /streams/near` + `GET /streams/:id` return layers; new `GET /streams/room/:roomId` endpoint for room lookup; mediasoup pushes `viewerCountUpdated` to broadcaster on every join/leave. `LayerType = 'camera' \| 'audio'` added to shared types. `signalingClient.onMessage()` added. No new npm packages. |
| 7     | upcoming | Custom dev client (EAS Build); `react-native-webrtc` + `mediasoup-client`; creator broadcast view; viewer consumption view; multi-angle hop UX                                                                                                                                                                                                                                                                                                                                         |

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

---

## Anonymous viewing & auth model — architecture decision (Phase 3 prep)

> **Decided** before Phase 3a (May 2026). This section documents the
> intended auth model on the app side. wrld-backend CLAUDE.md has the
> matching backend-side detail.

## The product call

Anonymous users — people who downloaded the app and haven't signed up
— **can browse and watch live streams** without creating an account.
Signup is required only when they try to do something tied to identity:
go live, comment, favourite, follow, get notified.

The signup prompt is a **modal triggered at the moment of attempted
action**, not a gate at app launch. Phase 6/7 implements the modal
flow; Phase 3 sets up the auth/anonymous split that makes it possible.

## Anonymous = truly anonymous

We deliberately rejected device-bound IDs and Clerk anonymous sessions.
Anonymous viewers are unidentifiable +1s. The app does not generate or
store any local UUID for them. They have no watch history, no
carry-over at signup, no backend row.

## What this means for the app code

### Auth state has three states, not two

The Clerk SDK gives us `useAuth()` which returns a signed-in / signed-out
boolean (and a session token getter). For WRLD's purposes treat this
as three states:

1. **Loading** — Clerk SDK hasn't determined yet (initial app launch
   for ~1-2s). Show a splash; don't make API calls.
2. **Signed out** — Clerk says the user has no session. **This is the
   anonymous state.** Allowed to browse, view streams, navigate the
   globe. Cannot favourite, comment, broadcast.
3. **Signed in** — Clerk has an authenticated session with a JWT. Full
   feature access.

Most app screens render the same UI for signed-out and signed-in. The
difference shows up in:

- Specific action buttons (favourite, comment, "go live") which are
  either hidden or trigger a signup modal
- The axios interceptor (next section)
- The mediasoup-client connection (Phase 3b)

### Axios interceptor sends JWT conditionally

The interceptor in `src/api/client.ts` checks Clerk's auth state. If
the user is signed in, it attaches `Authorization: Bearer <jwt>`. If
signed out, it sends the request with no auth header. The wrld-backend
API uses an `optionalAuth` middleware that accepts both cleanly.

This means the same axios methods work for both anonymous and
authenticated users — no parallel "anonymous client" needed.

Errors handling: if the API returns 401 on a route the app expected to
be authenticated, that's a real bug (we should know which routes need
auth). If the API returns 401 on what the app thought was a public
route, the app should treat it as a server-side auth-config issue, not
silently retry.

### Routes available to anonymous users (the navigable surface)

By the end of Phase 3, anonymous users should be able to:

- Open the app
- See the globe (`(app)/globe`)
- Tap a pin and see a stream's metadata
- Open the stream view (`(app)/stream/[id]`) — though the WebRTC
  consume path itself is Phase 7
- Browse user public profiles (`/users/:id` API → eventual screen)

Anonymous users should NOT be able to navigate to:

- The dashboard (which is for going-live; meaningless without an account)
- Any "edit profile" or settings screens
- Any "your streams" / "your favourites" screens

Phase 1 already has placeholder routing structure with `(auth)` and
`(app)` route groups. The cleanest way to handle this is probably to
allow anonymous users into `(app)` but gate specific actions/sub-routes
inside it. The `(auth)` group remains the signin/signup screens.

### Login/signup screens

Phase 3a replaces the Phase 1 stub login/signup screens with real
Clerk components from `@clerk/clerk-expo`. The user reaches them via:

- Tapping "Sign in" / "Sign up" in the app's UI (e.g., a header button
  on the globe screen)
- Triggered automatically by the signup modal flow when an anonymous
  user attempts a gated action

Both paths land in the same `(auth)` route group. After successful
auth, the user is redirected back to wherever they were.

## What this means for the mediasoup-client (Phase 3b)

The app's mediasoup-client wrapper:

- **Connects to `wss://media.wrld.cam` unconditionally** — works for
  both anonymous and authenticated users
- **If signed in:** includes the Clerk JWT in the connection params,
  enabling both consume and produce capabilities
- **If signed out:** connects without a JWT, can only consume

Going live (creating a producer) requires a JWT. The signaling server
enforces this. The app's "go live" button only appears when signed in,
or triggers the signup modal first when tapped while signed out.

## Out of scope for Phase 3

- The signup modal UX itself (Phase 6/7 — when comment/favourite/etc.
  features land)
- Anonymous-friendly empty states ("Sign up to save streams") on
  screens that show user-specific data
- Push notifications (Phase 4+)
- Polished signed-out → signed-in transition animations
