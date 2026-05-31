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
- **`@expo/vector-icons`** (Feather glyph set) — added in sub-phase 12.4 for the `Icon` primitive
- **`react-native-keyboard-controller`** + peer chain (**`react-native-reanimated`** v4, **`react-native-worklets`**) — added in sub-phase 12.4 for the `KeyboardProvider` + `KeyboardAwareScrollView` keyboard story under New Architecture. **`babel.config.js`** at repo root wires the worklets plugin.
- React 19 / RN 0.81

### Folder layout

Phase 12 introduces a tier-based structure for the design system. The
authoritative spec is [DESIGN.md Section 0](DESIGN.md#0-system-structure).
The folder migration shipped in sub-phases 12.1a (folder renames + screen
shims) and 12.1b (canvas extraction); the tree below describes the **current**
state. `src/components/sections/` is the one tier-folder not yet on disk —
per the reuse rule it materialises in 12.5 when the first section is built.
Within `src/canvas/scenes/earth/` only `EarthScene.tsx` + `index.ts` +
`assets/textures/` exist today; the sub-splits (`scene.ts`, `elements/`,
`environment/`, `controls/`) are deferred until a second scene proves the
shape — see [src/canvas/README.md](src/canvas/README.md).

```
app/                       # Expo Router routes (file = route)
├── _layout.tsx           # Root: providers (ClerkProvider, QueryClient, SafeArea)
├── index.tsx             # Auth-aware redirect
├── (auth)/               # Logged-out group
│   ├── login.tsx
│   └── signup.tsx
└── (app)/                # Logged-in + anonymous group (tabs)
    ├── globe.tsx         # Shim → GlobeScreen (post-12.1)
    ├── dashboard.tsx     # Shim → DashboardScreen (post-12.1)
    └── stream/[id].tsx   # Shim → StreamScreen (post-12.1)

src/
├── tokens/               # Tier: Tokens (palette + semantic; from src/lib/theme.ts)
│   └── theme.ts
├── components/           # Classical layer
│   ├── primitives/       # Tier: UI Primitives (was src/components/ui/)
│   ├── features/         # Tier: Features (was src/components/feature/)
│   ├── sections/         # Tier: Sections (new in 12.1)
│   └── screens/          # Tier: Screens (implementations; routes shim to here)
├── canvas/               # Canvas layer — GL scenes (sibling to components)
│   ├── scenes/earth/     # Earth scene (extracted from globe.tsx in 12.1)
│   ├── stage/            # Cross-scene canvas resources (token-to-RGBA bridge)
│   └── README.md
├── api/                  # Axios client + endpoint modules per resource
├── hooks/
│   ├── useSignaling.ts   # WebSocket room lifecycle (connect, createRoom, joinRoom, viewerCount, streamEnded)
│   └── useMediasoup.ts   # WebRTC media (startBroadcasting, startViewing, localStream, remoteStream, cleanup)
├── lib/
│   ├── mediasoupSignaling.ts  # Typed WebSocket signaling client (singleton: signalingClient); includes transport/produce/consume methods
│   └── ...               # env loader, clerkToken, tokenCache, polyfills (theme.ts moves to src/tokens/)
├── stores/               # Zustand stores
└── types/                # Shared types
```

**Tier rule:** classical tiers have downward dependencies only and no
self-composition (features don't nest in features, sections don't nest in
sections). Canvas is a sibling of classical, not nested in it; they meet only
at the **seam** (today: `DiscoveryHandoffCard`, a feature). See
[DESIGN.md Section 0](DESIGN.md#0-system-structure) for the full dependency
rule, the reuse rule, and the canvas vocabulary (scene / level / scene element
/ seam / resolved token value / stage).

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
| 5     | ✅ done  | 3D globe via `expo-gl` + `three.js` + `expo-three`. `GLView` renders a Three.js scene: 8K textured earth sphere, `PanResponder` drag-to-spin + pinch-to-zoom (camera z 1.1–8), GPS auto-orient to user's location on first fix, auto-rotation when idle, pins at each stream's lat/lng with constant screen size across zoom levels, raycaster tap-to-join. GL lifecycle hardened for Android context recreation. Metro `resolveRequest` intercept redirects `expo-three`'s loader imports to `stubs/threeLoaderStub.js` (null stubs for ColladaLoader etc.). Packages: `expo-gl`, `expo-location`, `expo-three`, `three` (`@types/three` removed — three ships its own types). Pin system later rewritten to geographic-clustered baked WebGL sprites — see Updates below. |
| 6     | ✅ done  | Stream source arming. Dashboard rebuilt: camera + audio source toggle cards (tap to "ready"), title input, Go Live button (disabled until ≥1 source + title + GPS). Tapping Go Live navigates to `stream/new` with `title` + `sources` as route params. `stream/[id].tsx`: broadcaster sees armed sources as active badges + live viewer count (pushed instantly via WebSocket `viewerCountUpdated`); viewer sees source switcher built from the `sources` param passed by the globe on tap-to-join. Full stack: `Stream.sources String[]` column + migration; `POST /internal/streams/started` accepts sources; `GET /streams/near` + `GET /streams/:id` return sources; new `GET /streams/room/:roomId` endpoint for room lookup; mediasoup pushes `viewerCountUpdated` to broadcaster on every join/leave. `SourceType = 'camera' \| 'audio'` added to shared types. |
| 7     | ✅ done  | Custom dev client (EAS Build); `react-native-webrtc` + `mediasoup-client`; broadcaster camera preview; viewer remote stream; multi-angle hop UX. **7a ✅** EAS project linked (`wrld-organization/wrld`, ID `35ab0828-46ac-477f-8ace-453105f6601e`), `react-native-webrtc ^124`, `mediasoup-client ^3.18`, `expo-dev-client ~6.0`, camera/mic/location permissions in `app.json`, Android APK built and installable. **7b ✅** `signalingClient` extended with `createTransport`, `connectTransport`, `produce`, `consume`. `useMediasoup` hook: `startBroadcasting(sources)` → getUserMedia → send transport → produce tracks; `startViewing(producers)` → recv transport → consume tracks into `remoteStream`; `cleanup()` tears down transports + stops tracks. Uses `ReactNative106` handler. **7c ✅** Broadcaster screen: `RTCView` fullscreen camera preview on go-live, translucent overlay with ● LIVE, viewer count, source badges, Leave. Audio-only falls back to standard layout. **7d ✅** Viewer screen: `RTCView` fullscreen remote stream, spinner while negotiating, `broadcasterLeft` WebSocket event sets `streamEnded` → shows "Stream has ended" UI. **7e ✅** Multi-angle hop UX. Tap viewer screen → controls overlay + `<NearbyStreamsDrawer>` slide up (auto-hide 3s); drawer shows horizontal row of nearby streams (within 100m of broadcaster's location) with title, source badges, distance; tap thumbnail → `cleanup()` + `router.replace()` → auto-join new stream immediately. Backend: `GET /streams/:id/nearby` (PostGIS ST_DWithin 100m, excludes self, returns `distanceMeters`, optionalAuth). App: `streamsApi.nearby(id)`, `useStreamsNearStream(id)` hook (polls 10s while drawer visible), `<NearbyStreamsDrawer>`, `<NearbyStreamThumbnail>`. Viewer screens always auto-join on mount (no manual join button). **7f ✅** 'See all' button in mini drawer header expands to full-height sheet (`<NearbyStreamRow>` vertical list with title, source icons, viewer count, distance). Tapping a row hops and closes the sheet; ✕ closes without hopping. Sheet auto-collapses when drawer hides. **Auth fixes ✅** Clerk v2 two-step sign-in; `document.hasFocus` polyfilled; login/signup redirect if already signed in. **iOS dev client ✅** Built and installed on both iPhones; `ITSAppUsesNonExemptEncryption: false`; both UDIDs registered. **Dev workflow:** install APK/IPA once; iterate with `npx expo start` + Metro hot reload. |
| 8     | ✅ done  | v0.2 begins. Identity & profile. Onboarding wizard (`app/onboarding.tsx`): handle picker with `bad-words` profanity filter and `user_` reserved-prefix blocklist enforced server-side; 30-day hold between handle changes; avatar = generated initials fallback + optional upload from camera/gallery via `expo-image-picker`, stored on Hetzner at `/opt/wrld-media/avatars/`. Public profile page (`app/(app)/profile/[handle].tsx`): follower/following counts, follow/unfollow button (`FollowButton` with optimistic UI). Own profile / account settings (`app/(app)/me.tsx`, `app/(app)/settings.tsx`): inline display-name + handle editing, avatar change, sign out. Search (`app/(app)/search.tsx`): handle + displayName, prefix match. Globe updated with tap-to-preview stream card (Avatar, title, @handle, viewer count, Join button) replacing immediate navigate-on-tap. Stream view (`app/(app)/stream/[id].tsx`) shows broadcaster identity row (Avatar + @handle). Root layout redirects new users to onboarding when `handle.startsWith('user_')`. `Avatar` component in `src/components/feature/user/`. New hooks: `useCurrentUser`, `useUserProfile`, `useUserSearch`, `useStream`. New API module: `src/api/users.ts`. |
| 9     | ✅ done  | Stream lifecycle reliability. Every stream interruption — broadcaster force-quit, graceful leave, network drop, app backgrounded — sends the viewer back to the globe with a banner. Graceful leave → "Stream has ended" banner. Network drop / background → "Stream disconnected" banner that polls for broadcaster return; if stream resumes, banner turns green and is tappable to rejoin. Key work: typed `StreamSignal` module for cross-screen communication; `BannerData` union in globe with auto-dismiss (8s ended, 5-min reconnect poll); `exitToGlobe(kind)` with `navigatingRef` double-navigation guard in stream view; all viewer navigation uses `router.navigate('/(app)/globe')` (stream screen is a tab, not a stack — `router.back()` is a no-op from a tab); `AppState` listener disconnects broadcaster WS on app background so server immediately fires `broadcasterLeft` to viewers; server ping/pong reduced from 30s to 10s for faster connectivity-loss detection (≤20s); server closes viewer WS with code 4001 after `broadcasterLeft`; client maps code 4001 → `streamEnded` state; `setStreamEnded(false)` in `connect()` and `navigatingRef` reset on room-id change fix state persistence across multiple stream sessions (tab component is never unmounted); viewer idle UI removed — viewers are always redirected to globe, the "Watch" screen has no valid path. |
| 10    | ✅ done  | Engagement. Ephemeral chat + emoji reactions in stream view, follow-a-streamer, AuthModal for anonymous users. **Chat:** `chatMessage` fans out through mediasoup to all room peers; auth required to send; anon viewers see the thread but get `AuthModal` on send attempt; `ChatOverlay` component (scrolling list + send input); keyboard shifts panel up via `Keyboard` event listener (KAV doesn't work inside absolute-positioned containers). **Reactions:** 4 emoji types (❤️🔥👏😮); Periscope-style `Animated` upward-drift burst; auth required; anon gets `AuthModal`. **Follow:** `FollowButton` shown to all viewers; reads real `isFollowing` from `GET /users/:identifier` (backend now includes it when request is authenticated); anon tap opens `AuthModal`; local state syncs via `useEffect` on query data so it survives `showControls` remounts. **AuthModal:** bottom-sheet signup/signin matching existing Clerk flow (email + password; signup triggers email_code verification step). **Bug fixes in this phase:** (a) viewer re-joining same stream produced black screen — `useEffect([id])` is blind to tab re-focus; replaced with `useFocusEffect` so every screen focus triggers join; (b) `FollowButton` reset to "Follow" on remount because `initialFollowing` was always `false` — fixed by reading server state via `useUserProfile`. |
| 11    | ✅ done  | Discovery & notifications. Expo Push Notifications via Expo's servers (routes to APNs/FCM). `PushSubscription` table on backend (token, platform, timezone, lat/lng, rate-limit timestamp). Notification prefs on `User` (`notifyOnFollowedLive` default true, `notifyOnNearbyLive` default off). Fan-out on stream start: followers + nearby (10km Haversine, 1/hr rate limit — both temporarily relaxed to 100km + no limit for testing). `useRegisterPushToken` hook: permission request, Android channel, Expo token + last-known location → backend. Root layout: foreground notification display + notification-tap deep-link to stream. Settings screen: two preference toggles. **Credential setup (one-time):** iOS: `eas credentials` → APNs key (Ben's Apple account). Android: Firebase project `wrld-b1d2d`, `google-services.json` at repo root, FCM V1 service account uploaded via EAS dashboard. **Install `expo-notifications` with `npx expo install`, never `npm install`** — the latter grabs the latest SDK version which won't match the compiled native modules. Broadcaster pause banner: `'inactive'` AppState (iOS Control Center/Notification Center) sends `broadcasterPaused` signal through mediasoup; viewers see pill banner "Stream paused · resuming shortly"; `'active'` sends `broadcasterResumed`. Android `'inactive'` doesn't fire for notification shade — no freeze on Android. |
| 12    | in progress (12.0–12.6 ✅, 12.7 upcoming) | Design system + visual polish. Authoritative spec: [DESIGN.md](DESIGN.md) (system structure in Section 0). Broken into eight sub-phases — 12.0 ✅ system structure; 12.1 ✅ folder migration; 12.2 ✅ asset drop + inventory pass (re-baselined v0.2 scope per DESIGN.md decision log 2026-05-29); 12.3 ✅ token audit + `src/tokens/theme.ts` (light-pivot palette); 12.4 ✅ 20 primitives shipped bottom-up + `ComponentGallery` + adopted `react-native-keyboard-controller`; 12.5 ✅ 47 features + 13 sections shipped on `design` (per Section 3 register); galleries split into Primitive / Feature / Section pages; CALayer focus-shadow rule documented (2026-05-30 decision-log entry) and audited across primitives; 12.6 ✅ every screen migrated to the design system on `design`: 15 screens (Settings, Me, Subscription, Dashboard, Onboarding, Login, Signup, Globe, Stream, Search, Profile, CreatorOnboarding, Wallet, TopUp, Cashout) + 4 legacy features retired (ChatOverlay, ReactionLayer, NearbyStreamRow, NearbyStreamThumbnail) + 3 surviving features kept (AuthModal, TipSheet, FollowButton — token-cleaned, on retirement runways) + 1 survivor refactored internally (NearbyStreamsDrawer composes StreamCard now); 12.7 upcoming — motion pass. Achieved when: every screen uses only tokens (no hex literals), the component gallery renders all primitive variants, and Ben judges the app "feels like the same product." |
| 13    | upcoming | Space Bucks + Star Dust + tipping. **Dual-currency model** (re-baselined 2026-05-29 — see DESIGN.md decision log). Space Bucks ($0.01) are spend-side, Star Dust ($0.01) are receive-side. Tipping 100 Space Bucks → 30 SB platform fee → recipient gets 70 Star Dust. Both currencies admin-seeded in v0.2 (no real-money IAP, no Cash Out — both deferred to v0.3 with the wallet UI shipping as components-built-but-stubbed). Tipping is the only functional transaction kind in v0.2; subscriptions + PPV components ship but are mock-data-only. **App:** `TipSheet` bottom sheet (presets 50 🚀 · $0.50 / 100 🚀 · $1 / 500 🚀 · $5 + custom amount); tip button in viewer controls overlay; auth gate for anonymous users. **Public burst:** `tipReceived` WebSocket message fans out, floating animation with tipper handle + amount. **Broadcaster toast:** private pill banner. **Balance:** shown in `TipSheet`, Me screen, and the new Wallet v2 screen. Constants: `SPACE_BUCKS_PER_DOLLAR = 100`, `STAR_DUST_PER_DOLLAR = 100`, `PLATFORM_FEE_PCT = 30`. |
| 14    | upcoming | Pre-v0.2 polish. Empty states, error states, first-time onboarding intro (a couple of screens introducing "what is WRLD"), globe initial orientation on user's location (not Central America), share-this-stream functionality (deep links via `wrld://stream/<id>` + Universal Links on `wrld.cam`). No App Store assets or public legal docs in v0.2 — this is an internal milestone for Ben + Aaron + small friends-and-family group, not a launch. Achieved when: Ben and Aaron each install the app on a fresh device, run through it top to bottom, and don't flinch at any rough edge. |

When Claude Code is asked to "do the next phase," verify the user means the
next unstarted phase above and ask before scaffolding multiple phases at once.

> **Phase 3 ↔ Chunk 3b naming note:** The backend session split Phase 2 into
> Chunk 1 (local), Chunk 2 (deploy), Chunk 3a (mediasoup server), and Chunk 3b
> (mediasoup client in the app). What was called "Chunk 3b" in those
> conversations is part of Phase 3 here. Same work, different naming convention.

---

## Phase parallelism

Phases 8–14 aren't strictly sequential — some can run in parallel:

- **Phase 8 (identity/profile) and Phase 12 (visual polish) can run in
  parallel.** Aaron drives Phase 8 (backend additions for follow, avatar
  upload, profile routes; app-side onboarding wizard and profile screens).
  Ben drives Phase 12 (token extraction from mocks, primitive components,
  Component Gallery dev route). They cross-pollinate — Aaron's new screens
  use Ben's primitives as they land.
- **Phases 9, 10, 11 are sequential.** Don't add chat/reactions/push on top
  of unreliable streams; don't notify users about streams that can't be
  joined reliably.
- **Phase 12 (Ben) and Phase 13 (Aaron) run in parallel.** Ben owns the
  design system; Aaron owns Space Bucks + tipping. They land independently
  and merge to main continuously.
- **Phase 14 last.** Polish-on-polish only makes sense once the polishable
  surfaces are settled.

### Current working agreement (Phase 12 era)

Phase 13 (Space Bucks tipping) shipped to `main`. The 2026-05-29 v0.2
re-baseline (see DESIGN.md decision log) reshapes Aaron's parallel work:
- **Wallet model** is now Space Bucks (spend) + Star Dust (receive) with a
  30% platform fee on transfer. Backend types + DB columns expand to
  hold a dual-currency balance per user.
- **No real-money interfaces ship in v0.2.** Top Up (IAP) and Cash Out
  (ACH + KYC) are component-only — Aaron stubs them with admin-seeded
  paths. Real Stripe / IAP / payouts are v0.3.
- **Subscriptions + PPV components ship in v0.2 mocks but are mock-data
  only.** Backend doesn't need to implement them in v0.2.

**Design branch state (2026-05-31):** 12.5 + 12.6 are both finished on
`design`. The branch carries 47 design-system features + 13 sections +
all 15 user-facing screens migrated to compose from them, plus the
4 legacy feature retirements and the 3 surviving features' token cleanup.
Ready to merge to `main` after Ben's on-device review of the full sweep.

**Design branch convention:** revived 2026-05-30 for 12.5+ work.
Originally used during 12.2 (per the 2026-05-29 decision-log entry),
merged back into `main` after 12.4 close-out, then re-spun off `main`
HEAD `c37266b` for the rest of Phase 12. Ben works on `design`; Aaron
continues on `main`; periodic merges between. The merge protocol:
pull `main` HEAD into `design` first, theme-codemod for any of
Aaron's net-new code on the pre-12.3 token shape, then push design →
main only after explicit Ben sign-off. See [DESIGN.md Section 6](DESIGN.md#6-decision-log)
("design branch revived for 12.5+") for the canonical entry.

`src/tokens/theme.ts` is live on `main` (the 12.3 light-pivot palette).
The 2026-05-29 note that `SubscriptionScreen` (and by inference the
wallet trio) still used hex literals is now obsolete — those four
screens are migrated on `design` and will land via the 12.5/12.6
close-out merge. The two repos overlap minimally (Aaron → `wrld-backend`;
Ben → `wrld-app`), so merge conflicts should be rare; the recent 12.4
close-out merge produced exactly one. `DESIGN.md` is Ben's primary doc;
`CLAUDE.md` is shared — whoever ships a phase updates it. See
[DESIGN.md Section 7](DESIGN.md#7-phase-12-sub-phase-path) ("Working
agreement with Aaron") for the canonical version.

**Pulling main after 2026-05-30:** the merge added native modules
(`@expo/vector-icons`, `react-native-keyboard-controller`,
`react-native-reanimated`, `react-native-worklets`) plus a new
`babel.config.js`. Aaron's existing Android dev client will red-screen
on `Unable to resolve module react-native-reanimated` until he installs
a fresh build. Run `eas build --profile development --platform android`
when that happens. The dev client rebuild is also a good time to drop
the `react-native-view-shot` Metro stub and install view-shot for real.

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
any circumstance — the discipline of saying no is what makes v0.2 shippable.

The 2026-05-29 re-baseline (DESIGN.md decision log) moved three previously-
deferred items into v0.2: recording/replay (via clips), broadcaster sensor
sources beyond audio/video (full 7-layer model), and the wallet UI (built but
real-money interfaces stubbed). What remains deferred:

- **No real-money payment movement.** The Wallet v2 / Top Up / Cash Out UI
  components ship in v0.2, but no actual money flows. Top Up (IAP via
  Stripe / Apple / Google) is NOT wired — Space Bucks remain admin-seeded.
  Cash Out (ACH + KYC) is NOT wired — Star Dust accrues with no payout.
  The 30% platform fee on transfers is logical bookkeeping only. Real
  payments + payouts + KYC are v0.3.
- **No subscriptions or PPV as functional features.** Mocks show monthly
  subscriptions and pay-per-view as transaction-kind chips in the wallet,
  but those are mock-data-only in v0.2. The TransactionRow component
  variants for them ship; the underlying flow is v0.3. Tipping is the only
  active monetization transaction in v0.2.
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

- **Time machine.** Earlier states of a stream or a broadcaster's history —
  distinct from clips (which v0.2 ships). Built on top of the v0.2 recording
  infrastructure but with different access semantics.
- **Real-money payments layer.** v0.2 ships the wallet UI (Wallet v2 + Top Up
  + Cash Out) but all real-money paths are stubbed:
  - Top Up via Stripe / Apple IAP / Google Pay (real money in).
  - Cash Out via ACH bank transfer + KYC verification (real money out).
  - The 30% platform fee on tips begins accruing as real platform balance
    once real money is in the system.
- **Subscriptions + PPV.** Monthly subscriptions to creators and pay-per-view
  unlocks of specific content. The wallet TransactionRow component variants
  for both ship in v0.2 as mock-only; v0.3 wires the actual subscription
  billing cycle and PPV gating infrastructure.
- **Additional broadcaster sensors.** v0.2 lands 7 layers (cam / audio /
  screen / loc / gyro / compass / profile-ID). Future sensor candidates —
  speed indicators, torch status, ambient temperature, motion intensity —
  remain v0.3+ as needed.

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

- **All commits go directly to `main` — no feature branches.** At a two-person
  team size the branching overhead isn't worth it. Both Ben and Aaron commit
  and push directly to `main` from their local machines, then `git pull` on
  the Hetzner box to deploy.
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
- **Don't add `@rnmapbox/maps` to `app.json` plugins.** It is already
  registered in `app.config.js` with the download token. Adding it to
  `app.json` as well causes the plugin to run twice and breaks the build.
- **Don't put either Mapbox token in committed files.** Both the public
  (`pk.`) and secret download (`sk.`) tokens go in EAS secrets + local `.env`
  only. GitHub secret scanning blocks `pk.` tokens in committed files.
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

---

## Updates — May 2026 (Phase 9: stream lifecycle reliability)

### Goal

Every stream interruption — in any direction, on any platform — sends the viewer back to the globe with a descriptive banner. No silent failures, no frozen frames, no dead-end "Watch" screens.

### Signal layer: `src/lib/streamSignals.ts`

Typed module-level signal for passing stream-end reason across the stream→globe navigation boundary (React navigation unmounts the stream screen before the globe can read props):

```ts
type StreamSignal =
  | { kind: 'disconnected'; broadcasterHandle: string | null }
  | { kind: 'ended' }
```

`signalStreamEnded()` / `signalStreamDisconnected(handle)` write the signal; `consumeStreamSignal()` reads and clears it. Globe reads it on focus.

### Globe banner: `app/(app)/globe.tsx`

`BannerData` union type drives three visual states:

- **`disconnected`** — muted banner, polls `streamsApi.get(streamId)` every 10s for up to 5 min. If stream comes back live, transitions to `resumed`.
- **`ended`** — muted banner, auto-dismisses after 8s.
- **`resumed`** — green banner, tappable to re-enter the stream with the same viewers.

Banner is positioned using `useSafeAreaInsets` and rendered outside the `pointerEvents="none"` globe layer so it's interactive.

### Stream view: `app/(app)/stream/[id].tsx`

Three exit paths, all funnelling through a single `exitToGlobe(kind)` function:

1. **Fast path 1** — `streamEnded` state becomes `true` (server sent `broadcasterLeft` WS message)
2. **Fast path 2** — `status === 'dropped'` (viewer's own WS closed unexpectedly)
3. **Fallback** — 10s poll on `streamsApi.get(streamId)`, catches cases where neither signal arrives (Android force-kill delay, iOS graceful-leave race, server quirks)

`navigatingRef` guard ensures only the first trigger wins when multiple signals arrive simultaneously (e.g. `broadcasterLeft` message + WS close in the same cycle).

**Critical navigation fix:** `stream/[id]` is a `Tabs.Screen` with `href: null` — it's a tab, not a stack screen. `router.back()` from a tab has no stack entry to return to and silently does nothing. All viewer exit paths use `router.navigate('/(app)/globe')` to explicitly switch tabs.

**Broadcaster backgrounding:** `AppState.addEventListener('change', ...)` disconnects the broadcaster's WS when `nextState === 'background'`. This immediately triggers `closePeer` on the server, which fires `broadcasterLeft` to all viewers and closes their sockets with code 4001. Without this, iOS/Android keeps the WS alive in background and viewers are stuck on a frozen frame indefinitely. Only `'background'` triggers disconnect — `'inactive'` (call ringing, notification center) does not, avoiding false positives.

**Session state reset between streams:** The tab component is never unmounted, so state from session N persists into session N+1. Fixed by:
- `setStreamEnded(false)` inside `connect()` — every new WS connection is a clean slate
- `navigatingRef.current = false` at the top of the `[id]` effect — reset guard for new session
- `cleanup()` + `handleJoin()` always called on `id` change (removed `status === 'idle'` pre-check — after a WS close with code 4001, status stays `'in-room'` so the old guard never fired)

**Viewer idle UI removed:** The "Watch" title and idle-state "Back" button served no valid viewer path. All viewer exit paths go to the globe; viewers are never intentionally left in idle state. The idle block is now gated on `isNew` (broadcaster only).

### Signaling hook: `src/hooks/useSignaling.ts`

- Added `'dropped'` to `SignalingStatus` union
- `onClose` handler distinguishes: intentional → `'idle'`; code `4001` → `setStreamEnded(true)`; other → `'dropped'`
- `setStreamEnded(false)` added to `connect()` to reset stale state from previous session

### Signaling client: `src/lib/mediasoupSignaling.ts`

- `closeCbs` typed as `Set<(code: number) => void>` — passes WS close code to subscribers
- `ws.onclose = null` before closing stale WS in `connect()` — prevents the old socket's close event from firing into the new hook subscriber's callback
- `onClose(cb)` updated to `cb: (code: number) => void`

### Server changes (`wrld-mediasoup`)

- **Ping/pong interval reduced from 30s to 10s** — zombie connections (force-killed clients, connectivity loss) now detected and terminated within 20s instead of 60s
- **Viewer WS closed with code 4001 after `broadcasterLeft`** — ensures viewers detect stream end even if the `broadcasterLeft` WS message is lost or arrives after a race condition. Code 4001 is the canonical "stream ended" signal on the client.

---

## Updates — May 2026 (Phase 11: push notifications)

### Push delivery: Expo Push

Expo Push Notifications (`expo-notifications`) route through Expo's servers to APNs (iOS) and FCM (Android). Free tier supports ~1M notifications/month, production-ready at 100k users.

**Critical: always install with `npx expo install expo-notifications`, never `npm install expo-notifications`.** `npm install` grabs the latest package version (e.g. SDK 56 when on SDK 54), which compiles native modules incompatible with the current dev client and crashes on startup with `Cannot find native module 'ExpoPushTokenManager'` or `AnyTypeCache` class-not-found errors.

### Credential setup (one-time per platform)

**iOS:** `eas credentials` → iOS → generates APNs key from Ben's Apple Developer account. Baked into the IPA at build time.

**Android:** Firebase project `wrld-b1d2d` (`google-services.json` at repo root, referenced in `app.json` as `"googleServicesFile": "./google-services.json"`). FCM V1 service account JSON downloaded from Firebase Console → Project Settings → Service accounts → Generate new private key, then uploaded via EAS dashboard (expo.dev → project → Credentials → Android → FCM V1). Without this, `getExpoPushTokenAsync` fails with `E_REGISTRATION_FAILED: Default FirebaseApp is not initialized`.

### `src/hooks/useRegisterPushToken.ts`

Runs once when the user signs in. Flow: request notification permission → set up Android channel → fetch `ExpoPushToken` (projectId hardcoded) → `Location.getLastKnownPositionAsync()` for lat/lng (best-effort, used for nearby notifications) → POST to `/users/me/push-subscription`.

### Root layout additions (`app/_layout.tsx`)

- `Notifications.setNotificationHandler` — shows banners (`shouldShowBanner`, `shouldShowList`) even when app is foregrounded. Note: `shouldShowAlert` is deprecated, use the two new flags instead.
- `useRegisterPushToken(!!isSignedIn)` called in `RootNavigator`
- `Notifications.addNotificationResponseReceivedListener` — handles notification taps; navigates to `/(app)/stream/[id]` using `mediasoupRoomId`, `streamId`, `sources` from notification data payload

### Settings screen (`app/(app)/settings.tsx`)

NOTIFICATIONS section with two `Switch` toggles:
- **Someone I follow goes live** (default on)
- **Live stream nearby** (default off)

Both call `PATCH /users/me/notification-preferences`. Initialized from `wrldUser` store; optimistic toggle with server revert on failure.

### `app.json` changes

- `expo-notifications` plugin: color `#5B8CFF`, `defaultChannel: 'default'`, icon `assets/images/icon.png`
- `"googleServicesFile": "./google-services.json"` under `android` — required for FCM initialization
- Android permissions: `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `POST_NOTIFICATIONS`

### Testing config (temporary — restore before production)

In `wrld-backend/src/services/notificationService.ts`:
- `NEARBY_KM = 100` (production: 10)
- Rate limit removed from nearby query (production: 1/hr per token, `lastNearbyNotifiedAt`)

### Broadcaster pause banner (viewer UX)

When the broadcaster's iOS app goes `'inactive'` (Control Center / Notification Center pulled down), the stream video freezes. The broadcaster sends a `broadcasterPaused` WebSocket signal; mediasoup fans it out to viewers who show a pill banner: "Stream paused · resuming shortly". When the overlay is dismissed, `'active'` fires and `broadcasterResumed` hides the banner.

**Android note:** pulling down the notification shade does NOT trigger `'inactive'` on Android — the app stays `'active'` and the camera keeps streaming. The pause banner is effectively iOS-only. On Android, only `'background'` (home button, task switcher) is relevant, which ends the stream entirely (existing behavior).

---

## Updates — May 2026 (Globe: baked sprite pins + broadcaster camera flip)

### Globe pin system rewrite (`app/(app)/globe.tsx`)

Replaced the two-layer pin architecture (WebGL sphere meshes + React Native `Animated.View` badge overlay) with a single `THREE.Sprite` per cluster rendered entirely inside the WebGL scene.

**Root cause of the old drift problem:** The globe is a `GLView` (WebGL) and the badges were `Animated.View` components positioned on top via absolute layout. These two render layers run at different cadences — the WebGL frame and the RN compositor are not synchronized — causing badges to visually separate from their pins during globe inertia. The new approach puts everything in the same coordinate space, so separation is impossible.

**New pin: `THREE.Sprite` + `THREE.DataTexture`**

Each pin is a `Sprite` (billboard, always faces camera) with a `DataTexture` built from a raw `Uint8Array` pixel buffer — no DOM canvas, no external assets, works in expo-gl. Three concentric layers are drawn in `makePinTexture(count)`:
- **Fill circle** — blue `#5B8CFF` for clusters, red `#FF3B5C` for singles
- **White border ring** — 2px thick
- **Quadratic glow halo** — `t = (glowR - d) / (glowR - borderR); alpha = t² × 120`, extending 14px beyond the border

Cluster pins also render the stream count using a hand-rasterised 5×7 bitmap font (`GLYPH` dict of digit row-bitmasks, 3× upscaled). Critical detail: `DataTexture` uses bottom-left origin (OpenGL convention), so glyph rows must be written in reverse order (`GH - 1 - row`) to display right-side up. `tex.minFilter = tex.magFilter = THREE.LinearFilter` for bilinear antialiasing at the GPU level.

Texture cache: `Map<string, DataTexture>` keyed by count string — at most ~11 textures allocated regardless of stream count.

`SpriteMaterial` flags: `depthTest: true, depthWrite: false` — globe depth buffer naturally occludes back-face sprites without any manual projection check; sprites don't occlude each other.

**Geographic clustering: `buildGeoClusters(streams, cameraZ)`**

O(n²) greedy nearest-centroid pass. Only runs when camera Z changes >0.12 or stream count changes — never per frame. Zoom-adaptive threshold: `0.01 + t × 0.17` (tight at close zoom, loose when pulled out). Centroid is a running average as streams join a group. Output is capped at `POOL_SIZE = 30` visible sprites.

Performance note: at 1000 streams, ~500K haversine comparisons per rebuild, producing at most one ~20–50ms stutter on zoom-level change. Frame rate is unaffected because the sprite pool is always ≤30 objects.

### Globe performance fixes

**Removed `Animated.View` pool.** The prior system unconditionally mounted 30 `Animated.View` badge components. Each creates a native compositor layer; `setValue()` calls fired every frame. At 30 views × 3 setValue calls × 60fps that was ~5,400 native bridge round-trips per second — causing baseline globe lag even with zero streams loaded.

**Removed React state on touch start.** `setBadgesHidden(true)` in `onPanResponderGrant` triggered a React re-render mid-gesture. React recreated the `PanResponder` during the gesture, dropping touch tracking before the finger lifted and breaking tap-to-join. Fix: no React state changes on touch start.

### Broadcaster camera flip (`src/hooks/useMediasoup.ts`, `app/(app)/stream/[id].tsx`)

`useMediasoup` additions:
- `facingMode` state (`'user' | 'environment'`, starts `'environment'`)
- `switchCamera()`: calls `videoTrack._switchCamera()` (react-native-webrtc internal — flips front/back without creating a new stream, mediasoup producer continues uninterrupted) and toggles `facingMode`

`stream/[id].tsx` additions:
- Flip button (⇄, 44×44 rounded, top-right corner) visible during broadcaster camera preview
- `RTCView mirror={facingMode === 'user'}` — front camera mirrored (natural selfie orientation), back camera unmirrored (correct real-world orientation)

---

## Updates — May 2026 (Globe: Mapbox street-level zoom handoff)

### Overview

Pinching in on the Three.js globe past a zoom threshold hands off to a Mapbox
`MapView` (satellite + street labels style) centred on the exact lat/lng the
user was looking at. Zooming back out in Mapbox returns to the globe. This is
"Option 1" — Three.js for the outer view, Mapbox for close zoom — chosen over
a full Mapbox replacement or Google Maps because it keeps the distinctive
globe UX while enabling street-level detail at no extra infrastructure cost.

### Package

`@rnmapbox/maps@10.3.1` — installed with `npm install`, not `npx expo install`
(the Expo wrapper isn't needed here). This is a **native module** — adding it
requires a new EAS dev client build before the native code is available. The
JS side installs with `npm ci`; the native side only lands via a build.

### Token setup (two distinct tokens)

| Token | Prefix | Purpose | Where it lives |
|---|---|---|---|
| Public / runtime | `pk.` | MapView tile requests at runtime | `.env` as `EXPO_PUBLIC_MAPBOX_TOKEN`; EAS secret for builds |
| Secret download | `sk.` | Native SDK download during EAS build | EAS secret as `MAPBOX_DOWNLOADS_TOKEN` only — never in code |

**Never commit either token.** GitHub secret scanning blocks `pk.` tokens too,
even though they are technically "public". Both go in EAS secrets; both go
in each developer's local `.env` (not tracked by git). Without
`EXPO_PUBLIC_MAPBOX_TOKEN` in `.env`, Metro bundles an empty string, the map
loads without tiles, and it shows a 401 error in the logs.

To add/rotate tokens:
```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value pk.…
npx eas secret:create --scope project --name MAPBOX_DOWNLOADS_TOKEN --value sk.…
```

### `app.config.js`

Dynamic config that extends `app.json` and injects `MAPBOX_DOWNLOADS_TOKEN`
into the `@rnmapbox/maps` plugin at build time so the native SDK can download
during EAS build. **Do NOT also add `@rnmapbox/maps` to the `plugins` array
in `app.json`** — it is already registered here and double-registration causes
the plugin to run twice.

```js
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['@rnmapbox/maps', {
      RNMapboxMapsImpl: 'mapbox',
      RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN ?? '',
    }],
  ],
})
```

### `app/(app)/globe.tsx` — key constants and decisions

```ts
const MAPBOX_ACTIVATE_Z = 1.5      // globe camera Z ≤ this triggers handoff on pinch release
const MAPBOX_DEACTIVATE_ZOOM = 3   // Mapbox zoom < this returns to globe
// Initial Mapbox zoom on activation: 4 (large-country / region level)
// Style: Mapbox.StyleURL.SatelliteStreet
```

**Activation fires on `onPanResponderRelease`, not during the move.** Firing
mid-pinch (in `onPanResponderMove`) causes a mid-gesture conflict: the
PanResponder blocks new gestures immediately while Mapbox is still loading,
leaving the user stuck. Deferring to release lets the current pinch finish
naturally, then Mapbox fades in cleanly.

**Globe zoom clamps at `MAPBOX_ACTIVATE_Z`** (not a lower value) during a
pinch — the user feels a soft stop, lifts fingers, and the handoff fires.

**`mapboxActiveRef` (ref, not state)** is read inside the PanResponder closure
for `onStartShouldSetPanResponder` / `onMoveShouldSetPanResponder`. State
changes are async; refs are synchronous — critical here because the responder
check fires in native event handlers.

**`mapboxSettledRef`** becomes `true` 1.5 s after activation. Guards against
`onCameraChanged` triggering deactivation during the initial camera flyTo
animation, which passes through zoom values below `MAPBOX_DEACTIVATE_ZOOM`.

**Lazy mount:** `mapboxEverActivated` state gates the `<Animated.View>` +
`<Mapbox.MapView>` in the render tree. MapView mounts on first activation and
stays mounted (invisible, `pointerEvents="none"`) when the globe is showing —
no teardown/reinit cost on subsequent activations.

**Coordinate math** (globe rotation → Mapbox centre):
```ts
// savedRotationRef.current = { x: rotX, y: rotY } in radians
lat = rotX * (180 / Math.PI)
lng = -(rotY * (180 / Math.PI)) - 90
// Mapbox coordinate order: [longitude, latitude]
```

### Dev-client rebuild requirement

Any time `@rnmapbox/maps` is added or upgraded, every developer must install
a fresh EAS dev client build before the native module is available. The
error `@rnmapbox/maps native code not available. Make sure you have linked
the library and rebuild your app` means the running APK/IPA predates the
native module. Check expo.dev → Builds for a recent development build, or
trigger one:
```bash
npx eas build --platform android --profile development
npx eas build --platform ios --profile development
```

---

## Updates — May 2026 (Phase 3 admin: subscription tier screen)

### Subscription tier screen (`src/components/screens/SubscriptionScreen.tsx`)

New screen matching the Claude Design spec. Accessible from Settings → ACCOUNT →
Plan row. Route: `app/(app)/subscription.tsx`.

**UI elements:**
- Monthly / Annual billing toggle (annual = ~20% off, "two months free" note)
- Three tier cards: Free (always free), Plus ($5/mo or $48/yr), Pro ($20/mo or $192/yr)
- Current tier highlighted with a stronger blue border (`wrldUser.tier` from auth store)
- Feature comparison matrix (expandable, matches the Claude Design)
- Plus/Pro CTAs show an Alert ("coming soon") — no payment flow wired yet.
  Free CTA shows "Your current plan" when already on Free.

**No EAS rebuild needed** — pure JS. Metro hot-reload picks it up immediately.

### Settings screen (`src/components/screens/SettingsScreen.tsx`)

New ACCOUNT section above NOTIFICATIONS. Contains a single "Plan" row that shows
the current tier name + "View all plans" and navigates to `/(app)/subscription`.

### `User` type (`src/types/index.ts`)

`tier: 'free' | 'plus' | 'pro'` added. Populated by `GET /auth/me` — the backend
now includes `tier` on every user response since it's a column on the `User` model.
The auth store (`wrldUser`) carries it without any additional fetch.
