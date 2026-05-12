# CLAUDE.md — WRLD App

This file is read by Claude Code at the start of every session. It captures
project context, architectural decisions, and conventions so any Claude
instance working in this repo is immediately oriented.

> **Human collaborators:** Ben (Mac, founder/dev) and Aaron (Windows, founder/dev).
> Two-person team building WRLD.

> **Sister repos:**
>
> - `wrld-backend` (Fastify API + Postgres + Caddy in Docker on the
>   Hetzner box). Shares Clerk for auth and the API contract documented
>   in `wrld-backend/docs/API.md`.
> - `wrld-mediasoup` (mediasoup signaling server, runs natively on the
>   same Hetzner box as a systemd service). The app connects to it over
>   WSS for signaling and over WebRTC for media.

> **Release naming:** v0.1 = alpha (Phases 1–7, the build-out). v0.2 = beta
> milestone (Phases 8–13, polish + social loop + reliability for daily use by
> Ben, Aaron, and a small friends-and-family group). v0.3 = next major
> milestone after v0.2 — known commitments listed below.

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
4. Or: hit the dashboard, arm your stream sources, go live yourself

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
- **API: Fastify on Hetzner**, not Lambda. Same box as mediasoup.
- **mediasoup runs natively on the host**, not in Docker. RTC port handling
  and `ANNOUNCED_IP` semantics are simpler that way. The Caddy container
  reaches it via the Docker compose-network gateway IP — see wrld-backend's
  CLAUDE.md (Chunk 3a section) for the gnarly networking details.
- **ORM: Prisma** (Ben/Aaron familiar).
- **Stream lifecycle source of truth: mediasoup → API webhooks** (Option B).
  When mediasoup says a room is created, we write the Stream row (Phase 4
  change from the original "when first producer fires"). Heartbeats every 30s;
  reaper job marks stale rows `isLive=false` if heartbeats stop.
- **Long-term provider mix:** Hetzner for media + API + DB (cheap egress —
  critical for streaming). Clerk for auth. AWS or Cloudflare for utility
  services (S3-compatible storage, CDN, push) when those phases come.

---

## Repo conventions

### Stack

- React Native via **Expo SDK 54**. Custom dev client (EAS Build) introduced
  in Phase 7 for `react-native-webrtc`. From Phase 7 onward, dev iteration
  uses the dev client + `npx expo start`, not Expo Go.
- **Expo Router** (file-based) for navigation
- **TypeScript strict** everywhere
- **Zustand** for client state
- **TanStack Query** for server state
- **Axios** for HTTP
- **Clerk** (`@clerk/clerk-expo`) for auth — added in Phase 3
- **mediasoup-client** + **react-native-webrtc** for live media — added in Phase 7
- **expo-gl** + **three** for the 3D globe — added in Phase 5
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
    ├── globe.tsx         # 3D globe with stream pins (Phase 5)
    ├── dashboard.tsx     # Source arming + Go Live (Phase 6)
    └── stream/[id].tsx   # id=new → broadcaster; id=<roomId> → viewer (Phase 7)

src/
├── api/                  # Axios client + endpoint modules per resource
├── components/
│   ├── ui/               # Primitives (Button, Input, ...)
│   └── feature/          # Feature-specific components
├── features/             # Feature modules (auth, streams, ...)
├── hooks/
│   ├── useSignaling.ts   # WebSocket room lifecycle (connect, createRoom, joinRoom, viewerCount, streamEnded)
│   └── useMediasoup.ts   # WebRTC media (startBroadcasting, startViewing, localStream, remoteStream, cleanup)
├── lib/
│   ├── mediasoupSignaling.ts  # Typed WebSocket signaling client (singleton: signalingClient); includes transport/produce/consume methods
│   └── ...               # env loader, theme tokens, clerkToken, tokenCache, polyfills
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

### Dependency hygiene

Lessons learned the hard way during Phases 4–5. These rules prevent the
"works on Aaron's machine but not Ben's" failure mode.

**For routine pulls — always `npm ci`, never `npm install`:**

After `git pull`, if `package.json` or `package-lock.json` changed (check
the pull output or run `git diff HEAD@{1} HEAD --name-only | grep -E 'package(-lock)?\.json'`), run:

```bash
npm ci
```

`npm ci` installs exactly what `package-lock.json` specifies, deterministically.
It will NOT modify the lockfile. `npm install` re-resolves the dep tree and can
silently rewrite the lockfile, causing it to drift from what's committed.

**For adding/removing deps — always go through npm, never edit `package.json` directly:**

```bash
npm install <pkg>      # adds + updates BOTH package.json and lockfile
npm uninstall <pkg>    # removes + updates BOTH
```

Editing `package.json` by hand (or having Claude Code edit it as text) without
running `npm install` afterward leaves the lockfile stale. Don't do this.

**Before committing changes to `package.json` or `package-lock.json` — verify clean install:**

```bash
rm -rf node_modules
npm ci                     # MUST succeed without --force or --legacy-peer-deps
npx expo start --clear     # MUST bundle and run
```

A `package.json` that only installs with `--force` is broken even if your
machine appears to work. The peer-dep warnings npm tries to bypass with
`--force` represent real version mismatches that will crash at runtime later.
Don't push something you only got working by suppressing the safety check.

If `npm ci` fails with "lockfile and `package.json` don't match": this means
whoever pushed the last commit didn't include their regenerated lockfile. Ask
them to fix it at the source — don't run `npm install` on your machine to
paper over it (that creates lockfile drift between you).

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

| Phase | Status   | What |
| ----- | -------- | ---- |
| 1     | ✅ done  | Dev environment, Expo Router scaffold, auth/dashboard/stream placeholder screens, Zustand auth store, axios client, theme + UI primitives. Verified end-to-end on Ben's iPhone via Expo Go. |
| 2     | ✅ done  | Backend infrastructure. Chunk 1 ✅ (local backend dev), Chunk 2 ✅ (Hetzner deploy live at api.wrld.cam, end-to-end signup verified), Chunk 3a ✅ (mediasoup signaling server live at media.wrld.cam, 5 lifecycle calls wired). |
| 3     | ✅ done  | App-side mediasoup signaling (Expo Go, no native WebRTC yet). `src/lib/mediasoupSignaling.ts` — typed WebSocket client with promise-based protocol. `src/hooks/useSignaling.ts` — React hook managing connection/room state. `stream/[id].tsx` — broadcaster (id=new) and viewer (id=roomId) flows. Dashboard test controls (Go Live + room ID join). Verified end-to-end on Aaron's iPhone (broadcaster) and Ben's Android (viewer, room 7240) with wrld-backend receiving streamStarted. |
| 4     | ✅ done  | `expo-location` for GPS; `useLocation` + `useStreamsNear` hooks; `streamsApi.near()`; Go Live flow passes real title + coords to mediasoup; globe screen shows nearby stream cards (tap → join room). Fix: `streamStarted` moved to `createRoom` (not `produce`) so streams are discoverable before Phase 7 media. Fix: API port 3000 bound to loopback so mediasoup can reach it. Verified: Aaron streamed, Ben saw stream card on globe and joined. |
| 5     | ✅ done  | 3D globe via `expo-gl` + `three.js` + `expo-three`. `GLView` renders a Three.js scene: 8K textured earth sphere, `PanResponder` drag-to-spin + pinch-to-zoom (camera z 1.1–8), GPS auto-orient to user's location on first fix, auto-rotation when idle, red pins at each stream's lat/lng with constant screen size across zoom levels, raycaster tap-to-join. GL lifecycle hardened for Android context recreation. Metro `resolveRequest` intercept redirects `expo-three`'s loader imports to `stubs/threeLoaderStub.js` (null stubs for ColladaLoader etc.). Packages: `expo-gl`, `expo-location`, `expo-three`, `three` (`@types/three` removed — three ships its own types). |
| 6     | ✅ done  | Stream source arming. Dashboard rebuilt: camera + audio source toggle cards (tap to "ready"), title input, Go Live button (disabled until ≥1 source + title + GPS). Tapping Go Live navigates to `stream/new` with `title` + `sources` as route params. `stream/[id].tsx`: broadcaster sees armed sources as active badges + live viewer count (pushed instantly via WebSocket `viewerCountUpdated`); viewer sees source switcher built from the `sources` param passed by the globe on tap-to-join. Full stack: `Stream.sources String[]` column + migration; `POST /internal/streams/started` accepts sources; `GET /streams/near` + `GET /streams/:id` return sources; new `GET /streams/room/:roomId` endpoint for room lookup; mediasoup pushes `viewerCountUpdated` to broadcaster on every join/leave. `SourceType = 'camera' \| 'audio'` added to shared types. |
| 7     | ✅ done  | Custom dev client (EAS Build); `react-native-webrtc` + `mediasoup-client`; broadcaster camera preview; viewer remote stream; multi-angle hop UX. **7a ✅** EAS project linked (`wrld-organization/wrld`, ID `35ab0828-46ac-477f-8ace-453105f6601e`), `react-native-webrtc ^124`, `mediasoup-client ^3.18`, `expo-dev-client ~6.0`, camera/mic/location permissions in `app.json`, Android APK built and installable. **7b ✅** `signalingClient` extended with `createTransport`, `connectTransport`, `produce`, `consume`. `useMediasoup` hook: `startBroadcasting(sources)` → getUserMedia → send transport → produce tracks; `startViewing(producers)` → recv transport → consume tracks into `remoteStream`; `cleanup()` tears down transports + stops tracks. Uses `ReactNative106` handler. **7c ✅** Broadcaster screen: `RTCView` fullscreen camera preview on go-live, translucent overlay with ● LIVE, viewer count, source badges, Leave. Audio-only falls back to standard layout. **7d ✅** Viewer screen: `RTCView` fullscreen remote stream, spinner while negotiating, `broadcasterLeft` WebSocket event sets `streamEnded` → shows "Stream has ended" UI. **7e ✅** Multi-angle hop UX. Tap viewer screen → controls overlay + `<NearbyStreamsDrawer>` slide up (auto-hide 3s); drawer shows horizontal row of nearby streams (within 100m of broadcaster's location) with title, source badges, distance; tap thumbnail → `cleanup()` + `router.replace()` → auto-join new stream immediately. Backend: `GET /streams/:id/nearby` (PostGIS ST_DWithin 100m, excludes self, returns `distanceMeters`, optionalAuth). App: `streamsApi.nearby(id)`, `useStreamsNearStream(id)` hook (polls 10s while drawer visible), `<NearbyStreamsDrawer>`, `<NearbyStreamThumbnail>`. Viewer screens always auto-join on mount (no manual join button). **7f ✅** 'See all' button in mini drawer header expands to full-height sheet (`<NearbyStreamRow>` vertical list with title, source icons, viewer count, distance). Tapping a row hops and closes the sheet; ✕ closes without hopping. Sheet auto-collapses when drawer hides. **Auth fixes ✅** Clerk v2 two-step sign-in; `document.hasFocus` polyfilled; login/signup redirect if already signed in. **iOS dev client ✅** Built and installed on both iPhones; `ITSAppUsesNonExemptEncryption: false`; both UDIDs registered. **Dev workflow:** install APK/IPA once; iterate with `npx expo start` + Metro hot reload. |
| 8     | upcoming | v0.2 begins. Identity & profile. Onboarding wizard (handle picker with profanity filter, reserved-prefix blocklist, 30-day holding period for released handles; avatar = generated initials by default + optional upload from camera or gallery, stored on Hetzner box for v0.2). Public profile page (`/users/:handle`). Account settings (sign out, delete account). Follow / unfollow. Search by handle and displayName. Stream metadata rendering on globe pins and stream view (broadcaster handle, avatar, title, live duration). Achieved when: a new user signs up, picks a real handle and avatar through the wizard, sees their own profile, can sign out and back in; a second user sees the first user's profile and can follow them; streams display broadcaster identity throughout. |
| 9     | upcoming | Stream lifecycle reliability + verification gate. Failure-mode tour. Broadcaster network drop, broadcaster app backgrounded (ends stream gracefully; foreground prompts "resume?"), broadcaster force-quit, viewer network drop, viewer joining a just-ended stream race. Viewer's reconnect overlay: "Reconnecting..." for 30s, then graceful pop-back to globe with "Stream paused" banner (server's 90s heartbeat-reaper threshold gives broadcaster time to recover before server marks ended). Achieved when: Ben and Aaron deliberately try to break each other's streams in five specific ways (kill WiFi, swipe app away, lock phone for 60s, force-quit, walk into a basement), and each failure either recovers smoothly or shows a clean, accurate error. No silent failures, no app crashes, no zombie "live" streams in Postgres after a clearly disconnected broadcaster. |
| 10    | upcoming | Engagement. Chat in stream view (ephemeral — lost when stream ends; v0.3 may persist per-stream). Emoji burst reactions (Periscope-style hearts/etc, no per-message reacts). Favourite-a-streamer (follows the broadcaster, not the ephemeral stream). Anonymous users see chat + reactions but trigger the signup modal when they try to send/favourite. Achieved when: Ben watches Aaron, both can chat in real time, both can fire reactions, and an anonymous viewer who tries to chat is gracefully prompted to sign up. |
| 11    | upcoming | Discovery & notifications. Push notifications: "someone you follow just went live" (on by default), "someone is streaming near you" (opt-in, default off). Notification preferences screen in account settings. APNs + FCM setup; server-side delivery with basic quiet-hours logic (suppress between 10pm–7am user local time; max 1 "nearby" notification per hour). Achieved when: Ben follows Aaron, Aaron goes live, Ben's phone receives a push notification, Ben taps it and lands directly in Aaron's stream. |
| 12    | upcoming | Visual polish. Design system implemented across all existing screens via primitive components in `src/components/ui/`. Theme tokens in `src/lib/theme.ts` derived from the approved mocks. Consistent typography, spacing, color, motion across globe, dashboard, stream view, profile, settings, auth screens. No new broadcaster sensor sources in v0.2 — compass/gyro/accelerometer/torch are explicitly deferred to v0.3. Achieved when: opening any screen feels like the same product; the app no longer looks like a series of phase deliverables glued together. |
| 13    | upcoming | Pre-v0.2 polish. Empty states, error states, first-time onboarding intro (a couple of screens introducing "what is WRLD"), globe initial orientation on user's location (not Central America), share-this-stream functionality (deep links via `wrld://stream/<id>` + Universal Links on `wrld.cam`). No App Store assets or public legal docs in v0.2 — this is an internal milestone for Ben + Aaron + small friends-and-family group, not a launch. Achieved when: Ben and Aaron each install the app on a fresh device, run through it top to bottom, and don't flinch at any rough edge. |

When Claude Code is asked to "do the next phase," verify the user means the
next unstarted phase above and ask before scaffolding multiple phases at once.

> **Phase 3 ↔ Chunk 3b naming note:** The backend session split Phase 2 into
> Chunk 1 (local), Chunk 2 (deploy), Chunk 3a (mediasoup server), and Chunk 3b
> (mediasoup client in the app). What was called "Chunk 3b" in those
> conversations is part of Phase 3 here. Same work, different naming convention.

---

## Phase parallelism

Phases 8–13 aren't strictly sequential — some can run in parallel:

- **Phase 8 (identity/profile) and Phase 12 (visual polish) can run in
  parallel.** Aaron drives Phase 8 (backend additions for follow, avatar
  upload, profile routes; app-side onboarding wizard and profile screens).
  Ben drives Phase 12 (token extraction from mocks, primitive components,
  Component Gallery dev route). They cross-pollinate — Aaron's new screens
  use Ben's primitives as they land.
- **Phases 9, 10, 11 are sequential.** Don't add chat/reactions/push on top
  of unreliable streams; don't notify users about streams that can't be
  joined reliably.
- **Phase 13 last.** Polish-on-polish only makes sense once the polishable
  surfaces are settled.

---

## v0.2 beta milestone — architectural decision (May 2026)

Decided between Phase 7 and Phase 8. This section documents what v0.2 is,
what it deliberately is not, and the product principles guiding Phases 8–13.

### What v0.2 is

A version of the app that Ben, Aaron, and a small friends-and-family group can
use daily without flinching at rough edges. The product is recognizably WRLD
— distinctive, polished, social. v0.2 is not a public launch; it's the
internal-dogfooding milestone where the social loop closes and the experience
stops feeling like a sequence of phase deliverables.

The bar for "v0.2 done" is: "Ben and Aaron each install the app on a fresh
device, run through it top to bottom, and don't flinch."

### Explicit non-goals for v0.2

These are deferred to v0.3 or later. Don't scope them into v0.2 phases under
any circumstance — the discipline of saying no is what makes v0.2 shippable:

- **No recording / replay / playback.** Streams are ephemeral. Miss it, miss
  it. (See v0.3 commitments below.)
- **No monetization** — no tipping, wallets, payments, gated content,
  subscriptions. Money flows trigger KYC, fraud surface, regulatory questions,
  app store review complications. None of that belongs in v0.2.
- **No broadcaster sensor sources beyond audio/video.** Compass, gyroscope,
  accelerometer, torch status, speed indicators — all deferred to v0.3. v0.2
  ships with just camera + audio sources, both already implemented in Phase 6.
- **No production-launch hardening.** Rate limiting, content moderation tooling
  beyond profanity-filtering handles, terms of service for external users, App
  Store submission assets, production Clerk separation, off-site backups. These
  belong to whatever comes after v0.3 when WRLD starts being shown to people
  outside the team.
- **No advanced onboarding** beyond the wizard in Phase 8 — no tutorials, no
  feature tours, no preference-elicitation flow. Friends-and-family can be told
  how to use the app verbally.
- **No analytics tooling** — no Mixpanel, no PostHog, no event tracking layer.
  v0.2 testing is direct conversation with testers.

### Anonymous viewing in v0.2

The anonymous-first model decided in Phase 3 carries forward unchanged:
anonymous users can browse, view streams, and watch reactions/chat happen.
Identity actions (chat, react, favourite, follow, go live) trigger the signup
modal at the moment of attempt. v0.2 is where the signup modal finally has a
reason to exist (Phase 10 adds the actual trigger surfaces).

### Friends-and-family scope = lower hardening bar

Because v0.2 is for known testers, several risks that would block a public
launch don't apply:

- No abuse handling. A bad actor in a known social circle is a social problem,
  not a software problem.
- No rate limiting. Traffic from a dozen people doesn't need throttling.
- No formal legal docs. Friends-and-family don't sign terms-of-service.
- No App Store distribution. Dev clients via EAS + TestFlight are fine for
  this group.

These all return to the table at v0.3.

### After v0.2 — known v0.3 commitments

These are explicitly deferred from v0.2 but are real obligations once v0.2
wraps. Capturing here so the v0.3 conversation starts from a known backlog,
not a blank page:

**Infrastructure migrations:**

- **Avatar storage migration.** v0.2 stores user-uploaded avatars on the
  Hetzner box at `/opt/wrld-media/avatars/<user-cuid>.<ext>`, served by Caddy
  at `https://api.wrld.cam/media/avatars/<user-cuid>.<ext>`. This is a
  knowingly temporary choice for v0.2 scale. v0.3 must migrate to dedicated
  object storage (Hetzner Object Storage, Cloudflare R2, or S3-compatible).
  Reasons: disk fills as user count grows; backup story doesn't extend to media
  files; conflates API and media serving in a way that needs untangling before
  scale.
- **Backup hardening.** Currently Postgres backups live on the same disk as
  Postgres (Phase 2 known weakness). With user-uploaded media added in v0.2,
  the same disk now also has irreplaceable user content. v0.3 must move backups
  off-site (S3/B2/Cloudflare R2) and include media files in the backup scope.
- **Caddy-serving-media → dedicated media path.** Once media moves to object
  storage, Caddy stops being a media server. This simplifies the API box's
  responsibilities and gets us closer to a clean separation.

**Product features:**

- **Recording / replay.** Server-side recording (probably HLS via a sidecar
  process), persisted stream archives, viewer rewatch UI. This is the biggest
  single infrastructure lift in the v0.3 backlog. Storage costs become real
  even at modest scale (hours of HD video → GBs).
- **Time machine.** Building on recording — earlier states of a stream or a
  broadcaster's history. Specifics deferred; requires recording infrastructure
  first.
- **Broadcaster sensor sources beyond audio/video.** Compass orientation is the
  most-likely first pick (matches the geographic framing of live streams).
  Gyroscope, accelerometer, speed, torch status are secondary candidates.
  Decision deferred to v0.3 scoping; for v0.2 the data layer is just
  video + audio.
- **Monetization.** Tipping, wallets, gated content, or subscription models.
  Decision deferred entirely — payments architecture is a whole-quarter
  discussion, not a feature ticket.

**Pre-launch hardening (before any non-friends-and-family users):**

- Production Clerk account separation (currently using dev keys in prod)
- Rate limiting on anonymous traffic
- Content moderation tooling (user reports, stream takedown, account suspension)
- Terms of service + privacy policy (real documents, not boilerplate)
- App Store submission assets (icon, screenshots, listing copy)
- Production-grade observability (log aggregation, metrics, alerting)
- Geo-discovery at scale (clustering, viewport-based queries on globe)

---

## How to run things (cheat sheet)

```bash
# Start the app (dev)
npx expo start

# Type check
npx tsc --noEmit

# After pulling a commit that touched package.json or package-lock.json
npm ci
```

From Phase 7 onward, you need the custom dev client (installed once via EAS
Build, then `npx expo start` connects to it for hot reload). Expo Go no longer
works — it doesn't include `react-native-webrtc` or other custom native modules.

Production endpoints to point the app at:

- API: `https://api.wrld.cam`
- Mediasoup signaling: `wss://media.wrld.cam`

Both go in `.env` under `EXPO_PUBLIC_*` keys.

This app's `.env`:

```
EXPO_PUBLIC_API_BASE_URL=https://api.wrld.cam
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_MEDIASOUP_WSS_URL=wss://media.wrld.cam
```

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
- **No surprise scope creep** — if a request implies more than what was asked,
  say so and confirm. Phase 4 had silent Phase 5 deps slip in; the cleanup cost
  real time. Don't do that again.
- **Tested before pushed** — for any commit that changes `package.json` or
  `package-lock.json`, run the clean-install verification in "Dependency
  hygiene" above before pushing.
- **Phase boundaries are real.** "Phase X done" means "Phase X done." Not
  "Phase X done plus partial Phase X+1 broken." When in doubt about whether
  something belongs in the current phase, surface the question.

When in doubt, ask before assuming.

---

## What NOT to do

- **Don't switch the database.** PostGIS was a deliberate choice over
  DynamoDB; revisiting requires explicit human decision.
- **Don't switch auth providers.** Clerk was chosen deliberately over Cognito
  and Keycloak; revisiting requires explicit human decision.
- **Don't add Redis "just in case."** The current scale doesn't need it.
- **Don't add new state libraries.** Zustand + TanStack Query covers the app.
- **Don't refactor working code without being asked.** New features only.
- **Don't bypass the phase plan.** If asked for Phase N+1 work while Phase N
  isn't done, ask whether to skip ahead or finish in order.
- **Don't preemptively add dependencies.** Ben's machine has tight file
  descriptor limits. Add deps as their phases need them, not in advance.
- **Don't edit `package.json` directly.** Use `npm install <pkg>` /
  `npm uninstall <pkg>` so the lockfile stays in sync. See "Dependency hygiene"
  above.
- **Don't push a `package.json` change without verifying clean install.**
  `rm -rf node_modules && npm ci && npx expo start --clear` must succeed
  without `--force` or `--legacy-peer-deps` before commit.
- **Don't put `CLERK_SECRET_KEY` (`sk_...`) anywhere in this repo.** Only the
  publishable key (`pk_...`) belongs in this codebase.
- **Don't put `INTERNAL_API_SECRET` anywhere in this repo.** That's the
  shared secret between mediasoup and the API, server-to-server only. The
  app never holds it.
- **Don't scope v0.3 features into v0.2 phases.** Recording, monetization,
  sensor sources beyond audio/video, public-launch hardening — all deferred.
  See "v0.2 beta milestone" above for the non-goals list.

---

## Anonymous viewing & auth model — architecture decision (Phase 3 prep)

> **Decided** before Phase 3a (May 2026). This section documents the
> intended auth model on the app side. wrld-backend CLAUDE.md has the
> matching backend-side detail.

### The product call

Anonymous users — people who downloaded the app and haven't signed up
— **can browse and watch live streams** without creating an account.
Signup is required only when they try to do something tied to identity:
go live, chat, react, favourite, follow, get notified.

The signup prompt is a **modal triggered at the moment of attempted action**,
not a gate at app launch. Phase 10 implements the trigger surfaces
(chat/react/favourite); Phase 3 set up the auth/anonymous split that makes
it possible.

### Anonymous = truly anonymous

We deliberately rejected device-bound IDs and Clerk anonymous sessions.
Anonymous viewers are unidentifiable +1s. The app does not generate or
store any local UUID for them. They have no watch history, no carry-over
at signup, no backend row.

### What this means for the app code

#### Auth state has three states, not two

The Clerk SDK gives us `useAuth()` which returns a signed-in / signed-out
boolean (and a session token getter). For WRLD's purposes treat this as three
states:

1. **Loading** — Clerk SDK hasn't determined yet (initial app launch for
   ~1-2s). Show a splash; don't make API calls.
2. **Signed out** — Clerk says the user has no session. **This is the
   anonymous state.** Allowed to browse, view streams, navigate the globe.
   Cannot favourite, chat, react, broadcast.
3. **Signed in** — Clerk has an authenticated session with a JWT. Full
   feature access.

Most app screens render the same UI for signed-out and signed-in. The
difference shows up in:

- Specific action buttons (favourite, chat send, react, "go live") which are
  either hidden or trigger a signup modal
- The axios interceptor (next section)
- The mediasoup-client connection

#### Axios interceptor sends JWT conditionally

The interceptor in `src/api/client.ts` checks Clerk's auth state. If the user
is signed in, it attaches `Authorization: Bearer <jwt>`. If signed out, it
sends the request with no auth header. The wrld-backend API uses an
`optionalAuth` middleware that accepts both cleanly.

This means the same axios methods work for both anonymous and authenticated
users — no parallel "anonymous client" needed.

Error handling: if the API returns 401 on a route the app expected to be
authenticated, that's a real bug. If the API returns 401 on what the app
thought was a public route, the app should treat it as a server-side
auth-config issue, not silently retry.

#### Routes available to anonymous users (the navigable surface)

Anonymous users can:

- Open the app
- See the globe (`(app)/globe`)
- Tap a pin and see a stream's metadata
- Open the stream view (`(app)/stream/[id]`) and consume live media
- Browse user public profiles (`/users/:handle` from Phase 8)

Anonymous users should NOT be able to navigate to:

- The dashboard (which is for going-live; meaningless without an account)
- Any "edit profile" or settings screens
- Any "your streams" / "your favourites" screens

The `(auth)` group is reachable from sign-in/sign-up entry points and from
the signup modal in Phase 10.

### What this means for mediasoup-client (Phase 3+)

The app's mediasoup-client wrapper:

- **Connects to `wss://media.wrld.cam` unconditionally** — works for both
  anonymous and authenticated users
- **If signed in:** includes the Clerk JWT in the connection params, enabling
  both consume and produce capabilities
- **If signed out:** connects without a JWT, can only consume

Going live (creating a producer) requires a JWT. The signaling server enforces
this. The app's "go live" button only appears when signed in, or triggers the
signup modal first when tapped while signed out.
