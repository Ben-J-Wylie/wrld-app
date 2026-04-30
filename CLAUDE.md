# CLAUDE.md — WRLD App

This file is read by Claude Code at the start of every session. It captures
project context, architectural decisions, and conventions so any Claude
instance working in this repo is immediately oriented.

> **Human collaborators:** Ben (Mac, founder/dev) and Aaron (Windows, founder/dev).
> Two-person team building WRLD's alpha.

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
        ├── Auth: AWS Cognito (ca-central-1) — JWT-based
        │
        ├── HTTPS API ─────▶ [Hetzner box]
        │                         ├── Caddy (TLS auto-issue)
        │                         ├── Fastify API (TypeScript)
        │                         ├── Postgres + PostGIS
        │                         └── mediasoup server (existing)
        │
        └── WebRTC ─────────▶ same Hetzner box (mediasoup)
```

**Key decisions:**

- **Two repos:** `wrld-app` (this one) and `wrld-backend` (separate).
- **Database: Postgres + PostGIS**, not DynamoDB. Multi-dimensional and
  geospatial queries dominate WRLD's workload.
- **API: Fastify on Hetzner**, not Lambda. Co-located with mediasoup for alpha
  to keep ops surface tiny. Migration path to separate boxes is documented.
- **ORM: Prisma** (Ben/Aaron familiar).
- **Stream lifecycle source of truth: mediasoup → API webhooks** (Option B).
  When mediasoup says a producer started, we write the Stream row. Heartbeats
  every 30s; reaper job marks stale rows `isLive=false` if heartbeats stop.
- **AWS scope:** Cognito only for now. SNS, S3 may come later.
- **Cognito region:** `ca-central-1` (Montreal). Both founders are Pacific NW;
  picked Canadian residency given Ben is in BC.

---

## Repo conventions

### Stack

- React Native via **Expo SDK 54** (managed workflow for Phases 1–6; custom
  dev client introduced in Phase 7 for `react-native-webrtc`)
- **Expo Router** (file-based) for navigation
- **TypeScript strict** everywhere
- **Zustand** for client state
- **TanStack Query** for server state
- **Axios** for HTTP
- **AsyncStorage** for persisted state (auth tokens, etc.)
- React 19 / RN 0.81

### Folder layout

```
app/                       # Expo Router routes (file = route)
├── _layout.tsx           # Root: providers (QueryClient, SafeArea, status bar)
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
- **Path aliases:** import from `@/...` instead of relative paths. `metro.config.js`
  resolves `@/foo` → `src/foo` at runtime.
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

| Phase | Status   | What                                                                                                                                                                                        |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | ✅ done  | Dev environment, Expo Router scaffold, auth/dashboard/stream placeholder screens, Zustand auth store, axios client, theme + UI primitives. Verified end-to-end on Ben's iPhone via Expo Go. |
| 2     | next     | `wrld-backend` repo: Fastify + Prisma + PostGIS + Cognito JWT verify + mediasoup webhooks + Docker Compose + Hetzner deploy scripts                                                         |
| 3     | upcoming | Real Cognito signup/login flow in app; email verification screen; `POST /auth/sync` after first login; token refresh in axios interceptor                                                   |
| 4     | upcoming | App calls `GET /streams/near` for the globe; "go live" flow that connects to mediasoup with location                                                                                        |
| 5     | upcoming | 3D globe via `expo-gl` + `three.js`; pins from streams API; tap → stream view                                                                                                               |
| 6     | upcoming | Dashboard with stream layer arming (audio/video/overlays/chat — exact "layer" semantics TBD)                                                                                                |
| 7     | upcoming | Custom dev client; mediasoup-client integration; creator broadcast view; viewer consumption view; multi-angle hop UX                                                                        |

When Claude Code is asked to "do the next phase," verify the user means the
next unstarted phase above and ask before scaffolding multiple phases at once.

---

## How to run things (cheat sheet)

```bash
# Start the app (dev)
npx expo start

# Type check
npx tsc --noEmit
```

---

## Backend repo (separate)

The API + Postgres live in `wrld-backend`, deployed to a Hetzner box that
also runs mediasoup. See its own `README.md` and `docs/` for ops.

API base URL goes into this app's `.env` as `EXPO_PUBLIC_API_BASE_URL`.

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
- **Don't add Redis "just in case."** The two-user alpha doesn't need it.
  Add when there's evidence of need.
- **Don't add new state libraries.** Zustand + TanStack Query covers the app.
- **Don't refactor working code without being asked.** New features only.
- **Don't bypass the phase plan.** If asked for Phase 5 work while Phase 3
  isn't done, ask whether to skip ahead or finish in order.
- **Don't preemptively add dependencies.** Ben's machine has tight file
  descriptor limits. Add deps as their phases need them, not in advance.
