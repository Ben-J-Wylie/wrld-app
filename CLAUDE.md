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

> **Content north star:** [`CONTENT.md`](CONTENT.md) is the cross-repo philosophy
> for how WRLD captures, stores, edits, **represents**, and surfaces content — the
> *why* behind the buffer/saved two-pool model, the non-destructive clip manifest
> (draft ↔ saved), the carve, capture ⊆ broadcast, the privacy ceiling, and the
> time machine. Its spine is **§2 — the content-handling directive** (a broadcast
> is N compartmentalized per-source captures, bound to one wall clock, buffered
> at the behest of the reaper, fully scrubbable + per-source editable — plus the
> evolution that earned it). It also states the **content-representation
> nuances** (§6) and the **cross-repo substrate requirements** (§9 — what
> `wrld-backend` + `wrld-mediasoup` must robustly provide). Principles land there;
> the weeds stay in the per-repo CLAUDE.md + `HANDOFF-*.md` + DESIGN.md. Keep it
> honest as the model evolves.

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
| 12    | ✅ done  | Design system + visual polish. Authoritative spec: [DESIGN.md](DESIGN.md) (system structure in Section 0). Eight sub-phases — 12.0 ✅ system structure; 12.1 ✅ folder migration; 12.2 ✅ asset drop + inventory pass (re-baselined v0.2 scope per DESIGN.md decision log 2026-05-29); 12.3 ✅ token audit + `src/tokens/theme.ts` (light-pivot palette); 12.4 ✅ 20 primitives shipped bottom-up + `ComponentGallery` + adopted `react-native-keyboard-controller`; 12.5 ✅ 47 features + 13 sections shipped on `design` (per Section 3 register); galleries split into Primitive / Feature / Section pages; CALayer focus-shadow rule documented (2026-05-30 decision-log entry) and audited across primitives; 12.6 ✅ every screen migrated to the design system on `design`: 15 screens (Settings, Me, Subscription, Dashboard, Onboarding, Login, Signup, Globe, Stream, Search, Profile, CreatorOnboarding, Wallet, TopUp, Cashout) + 4 legacy features retired (ChatOverlay, ReactionLayer, NearbyStreamRow, NearbyStreamThumbnail) + 3 surviving features kept (AuthModal, TipSheet, FollowButton — token-cleaned, on retirement runways) + 1 survivor refactored internally (NearbyStreamsDrawer composes StreamCard now); 12.7 ✅ motion pass — three named patterns shipped under `theme.motion.patterns` (`press`, `overlay`, `pulse`) and adopted by Pressable / BottomSheet / ToastBanner / LivePill / GoBar; dead CSS-string easing tokens replaced with RN `Easing` references; `screen-transition` deferred (expo-router handles route motion). |
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

**Design branch state (2026-05-31, evening):** 12.5 + 12.6 merged into
`main` at commit `f18bd48` (50 commits, includes back-merge of Aaron's
Phase 17 + Phase 5/22 work integrated through the design system).
Immediately re-spun the `design` branch off the same `f18bd48` HEAD for
12.7+ work — Ben elected to keep the high-churn isolation rather than
revert to direct-to-main, on the bet that motion-pass iteration plus
near-term DESIGN.md / token / primitive tweaks will benefit from the
same pattern that worked for 12.5/12.6.

**Design branch convention:** revived 2026-05-30 for 12.5+ work,
merged back to `main` at 12.6 close, then re-spun the same day for
12.7+. Ben works on `design`; Aaron continues on `main`; periodic
merges between. The merge protocol stays as established:
pull `main` HEAD into `design` first, theme-codemod for any of
Aaron's net-new code on the pre-12.3 token shape, then push design →
main only after explicit Ben sign-off. See [DESIGN.md Section 6](DESIGN.md#6-decision-log)
("design branch re-spun for 12.7+") for the canonical entry.

`src/tokens/theme.ts` is live on `main` (the 12.3 light-pivot palette).
The 12.5/12.6 close-out also brought the 47-feature / 13-section
register + 15 migrated screens to `main`, so Aaron can compose directly
from primitives / features / sections for any new monetization UI. The
two repos overlap minimally (Aaron → `wrld-backend`; Ben → `wrld-app`),
so merge conflicts should be rare. `DESIGN.md` is Ben's primary doc;
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

**Pulling main after 2026-06-06 (commit `111597c`):** the clip-editor work
added two native modules — **`expo-video`** (`~3.0.16`, Aaron's buffer HLS in
the scrub field) and **`react-native-gesture-handler`** (`~2.28`, the timeline
gestures; `GestureHandlerRootView` is now at the app root). **Any dev client
without these will red-screen on launch** (`Cannot find native module …`). A
fresh build is required for the app to run at all — `eas build --profile
development --platform all`. (A `development` build of `111597c` for both
platforms was kicked off 2026-06-06.)

---

## Rolling Buffer (Always-On Rewind) initiative — June 2026

> **Rolling-buffer lane — Ben / `design` (capture surface).** Read this before
> touching capture UI. The full model lives in the brief below + the
> per-repo lane notes in wrld-backend/CLAUDE.md and wrld-mediasoup/CLAUDE.md.
>
> **Your stage:** R4 only — retire the Record verb (`RecordCircle` + the
> GoLiveRecordBar Record affordance); add "save a clip" (retroactive, scrubs the
> buffer); buffer-window display ("rewind reaches back to ~Tuesday 3pm" — a
> timestamp, not a duration); subscription-screen rewind + resolution ladder
> (24h/720p · 72h/1080p · 7d/1440p); per-tier `getUserMedia` cap from
> `wrldUser.tier` (G4 = cap-produce, decided R0); retire the already-disabled
> SENSITIVE/BENIGN + `RecordConsentSheet` (or keep `RecordConsentSheet` parked).
> R4 runs parallel to Aaron's whole spine and integrates at R5.
>
> **Not your lane — do not edit:** `screens/`, `hooks/`, `api/` (Aaron's). Build
> R4 against a stubbed/mock buffer — do NOT wait on the real substrate.
>
> **Seam — Record-button removal:** you retire `RecordCircle` + the design-side
> states here; Aaron removes the button and rewires the verb in `StreamScreen`
> after the merge. (You do NOT edit `StreamScreen`.)
>
> **Merge protocol (unchanged):** pull `main` HEAD into `design` first,
> theme-codemod any of Aaron's net-new code, push `design → main` only on your
> explicit sign-off. Land R4 merged-ready EARLY so R5 isn't waiting on you.
>
> **Done-bar (on device):** the Record verb is gone, "save a clip" works against
> the stubbed buffer, the buffer-window display + subscription ladder render, and
> it's merged-ready before Aaron reaches R5.

Builds on the clips manifest model. Going live = continuously buffering the
stream into a self-overwriting rolling store; no Record button. The durable
verb is "Save a clip" (retroactive over the buffer). See the rolling-buffer
brief above + the per-repo lane notes for the full cross-repo model + R0–R5 rollout.

DECIDED: ring buffer; time-contract / byte-backstop; two pools (rolling buffer
+ curated GB saved-clip quota, permanent-until-deleted); per-tier caps Free
24h/720p · Plus 72h/1080p · Pro 7d/1440p; capture ⊆ broadcast (no record-
without-broadcast); shipping in v0.2.
R0 RESOLVED (Aaron + Ben, 2026-06-05): G4 = cap produce → app sets getUserMedia
constraints from wrldUser.tier (Free streams 720p live + rewind; no server
transcode). G5 = generous budget → byte caps sized to worst-case-plus-cushion
(~Free 61 GB · Plus 330 GB · Pro 1.5 TB); Aaron pins the exact per-resolution
bitrate ladder into RemoteConfig. R1 unblocked.

App-side (Ben, `design`, R4): retire the Record verb (RecordCircle); "Save a
clip" scrubs the buffer; ClipEditScreen edits the resulting manifest; buffer-
window display; per-tier getUserMedia cap; subscription ladder copy; retire the
already-disabled SENSITIVE/BENIGN + RecordConsentSheet. Supersedes the
2026-06-04 "single Record button on the stream view" model.

---

## Clips initiative — model, working split & rollout (June 2026)

The v0.2 recording/clips scope (re-baselined 2026-05-29) now has a decided
capture + editing model and a Ben/Aaron working split. This section is the
working reference for both; matching DECIDED sections live in
`wrld-backend/CLAUDE.md` and `wrld-mediasoup/CLAUDE.md`.

### Capture model (decided)

- **Two independent buttons.** **Go Live** publishes the broadcast set; **Record**
  captures the record set. Independent — live without recording, record without
  going live, both, or neither.
- **Two source sets.** Per source, a **broadcast** toggle (airs live?) and a
  **record** toggle (saved?), set independently. All four combinations per source
  are valid.
- **Seven sources** (the v0.2 layer model): camera, audio, screen, location, gyro,
  compass, identity. Identity is an **Attributed / Anon flag**, not a recorded
  track.
- **Privacy tiers.**
  - *Sensitive* — camera, audio, location (and **screen — OPEN**, see below):
    enabling **record** (especially record-without-broadcast) requires an explicit,
    visible **consent step**, and the during-broadcast **on-air-vs-recording
    indicator** must show recording state.
  - *Benign* — gyro, compass: record-on by default, low friction.
- **Guardrail (non-negotiable).** Nothing is captured silently. Record is always a
  visible chosen state, plus a persistent on-air-vs-recording indicator while
  broadcasting. The durable user-facing version of this promise is the Capture
  Privacy Constitution (pre-launch backlog).

> **App UI as shipped diverges on a few points** — kept in sync here so this
> section reads true against the build. The decided model above is still the
> cross-repo (backend / mediasoup) contract; the app made these v0.2 UX calls:
> (1) **the dashboard arms Air only** — the per-source **Rec toggle was removed
> 2026-06-04**; recording is a single **Record button on the stream view** that
> records whatever is on air. *(2026-06-03 had Air+Rec per source on the
> dashboard with one commit button — superseded.)* (2) **Go Live navigates to
> the stream view** (`stream/new`), which goes live on arrival — no intermediate
> "Start stream" step. *(2026-06-03 broadcast headlessly in place on the
> dashboard — superseded 2026-06-04.)* In-app navigation keeps the broadcast
> alive (the stream tab never unmounts); a tab-bar **live-return bar** + the
> globe's **black self-pin** navigate back; backgrounding/closing still end it.
> (3) the **SENSITIVE/BENIGN badges + the record-consent step are removed for
> now** (the guardrail's consent half is temporarily relaxed; the
> on-air-vs-recording indicator stays — re-enable before non-friends-and-family
> exposure); (4) the identity flag's UI label is **Public** / Anon; (5) dashboard
> location precision labels are **EXACT / CITY / COUNTRY / PRIVATE** (the separate
> `LocationGranularityPicker` feature keeps its own `bluedot` vocabulary). Full
> detail: the **June 2026 (Record moves to the stream view…)** update section
> near the end of this file + the DESIGN.md decision log.

### Editing model — per-source manifest (DECIDED June 2026)

A **Recording** is per-source tracks; a **Clip** is a **non-destructive manifest**
over a recording — no re-encode. `ClipEditScreen` (an unbuilt route) edits the
manifest:

- **Trim** — in-point / out-point.
- **Per-source** — on / off / **delete permanently** (the only destructive edit:
  removes a track from disk, reclaims quota); reveal a record-only source.
- **Identity** — Attributed / Anon. **Location** — `locDisplayPrecision`, only ever
  ≤ the captured ceiling. **Visibility** — public / anon / draft. **Tags.**
  > ⚠️ **Superseded 2026-06-13** (see CONTENT.md §1.4): identity + location are now
  > **fully reversible** (blur OR sharpen, either direction) — drop the ≤-ceiling
  > clamp; capture stores exact coords + real identity.

Most clip components shipped in 12.5 against mock data (ClipCard, ClipPreview,
Timeline, LayerEditorRow, FeedRow/FeedThumb). Storage usage is already available:
`GET /auth/me` returns `usedStorageBytes` + `storageQuotaBytes` — surface it in the
editor / profile.

### Open decisions

- **Profile vs Library — ✅ RESOLVED (2026-06-06): standalone Library**, not
  profile-as-library. The buffer-trim brief settled it; the saved-clips list is a
  standalone Library surface (off-footer, Me → Library), and the existing
  `LibraryScreen` was reskinned to `SavedClipRow`. The profile screens no longer
  need a library surface.
- **Screen source tier** — sensitive (consent-gated record) or benign. Mocked as
  sensitive; still to confirm (low-stakes now — the consent step is parked).
- **Record-set payload shape** — effectively **moot** under the rolling-buffer model
  (capture ⊆ broadcast; no separate record set / Record verb). Confirm it's dropped.

*(Resolved at C0: per-track `recordingReady` ✅ Aaron June 2026; existing-data
migration ✅ delete June 2026 — all legacy recordings purged from production.)*

### Working split (Ben / Aaron) — follows the tier boundary

- **Ben (`design` branch) — the component library.** Primitives / features /
  sections + DESIGN.md + galleries. The remaining clip additions are
  component-library work, so they're Ben's: the **FeedRow two-dimension control**
  (broadcast + record toggles, built from `SegmentedToggle`, with sensitive-tier
  consent treatment and the location-precision sub-control), the **Go Live + Record
  button states**, the **during-broadcast on-air-vs-recording indicator**, and the
  **LayerEditorRow not-captured state**. Plus the DESIGN.md Section 3 inventory +
  galleries.
- **Aaron (`main` branch) — screens + app logic.** Shared types (`SourceType` is
  already the 7-union; add `CaptureMode`, the two-set arming, the `Clip` manifest
  type), `DashboardScreen` assembly (two buttons + per-source two-toggle arming +
  defaults + consent flow + extend the go-live/record payload with the record set +
  wire the indicator), `ClipEditScreen` (compose the components + inline LayerPanel
  / TagsCard + wire the manifest), the profile screens (blocked on the
  profile/library decision), storage display, telemetry playback.
- **The seam.** Aaron does not touch `primitives/`, `features/`, `sections/`, or
  DESIGN.md; Ben does not touch `screens/`, `hooks/`, or `api/`. Integration via
  `design` → `main` merges.

### Phased rollout (C0–C6)

| Stage | Owner | Branch / repo | What | Depends on |
|---|---|---|---|---|
| **C0** | Ben + Aaron | — | Decisions & contracts. ✅ Model decided; ✅ per-track `recordingReady` Aaron June 2026; ✅ existing-data delete Aaron June 2026. Still open: **record-set payload shape** (only blocks C3 — C1 can proceed with provisional shape); **screen-tier** (blocks C2); **profile/library** (blocks C5). | — |
| **C1** | Aaron | mediasoup + backend | **✅ DONE (R1b-final).** Per-source recording substrate + always-on rolling buffer landed in both repos: `UserBuffer`/`BufferSession`/`BufferTrack`, fMP4 per-source tracks (`-c:v copy`), wall-clock-chunked `.jsonl` telemetry, per-track `recordingReady`, `bufferService.reapBuffers()` (window + byte-cap), tier caps in RemoteConfig, `GET /clips/discover`. | C0 model ✅ |
| **C2** | Ben | `design` | **✅ DONE (2026-06-06).** Buffer-trim component library: `BufferTimeline` (tap/pan/pinch) · `GapMarker` · `ClipBracket` · `SavedClipRegion` · `BufferScrubField` · `SavedClipRow` · `ClipSourcesDrawer` · `TimelineScrollbar` (+ galleries + DESIGN.md Section 3). Supersedes the single-track `Timeline` trimmer for the buffer flow. | C0 ✅ |
| **C3** | Aaron | `main` | Go Live / Record assembly on `DashboardScreen` (two buttons, per-source two-toggle arming, defaults, consent flow, payload, indicator wiring) + shared types. | C2 + record-set payload shape finalised |
| **C4** | Aaron (+ Ben scaffold) | `main` | **🔶 App scaffold built (Ben, 2026-06-06):** `ClipEditScreen` (route `app/(app)/clip-editor.tsx`, Me → Clip editor) composing the C2 components on a **MOCK SEAM** (`useMockBuffer`); Editor↔Saved pager; TimeScrubber overlaid as the buffer clock. **Remaining (Aaron):** wire the mock seam to real data (buffer segments / saved regions / recorded layers), the non-destructive **manifest** `Clip` model (replace baked `processClip`), real save/delete/publish. | C1 ✅, C2 ✅ |
| **C5** | Aaron (+ Ben scaffold) | `main` | **✅ profile/library decided → standalone Library** (not profile-as-library). Ben **reskinned the existing `LibraryScreen`** to `SavedClipRow` over real recordings (2026-06-06). **Remaining (Aaron):** storage display = the **R2** `GET /auth/me` dual-pool (`usedStorageBytes` + `bufferSizeBytes` + `bufferEarliestAt`); reconcile the editor's mock "Saved clips" list with the real Library (clips vs recordings). | C4 |
| **C6** | Aaron | `main` | Telemetry tracks playback (loc/gyro/compass overlays). | C1 ✅ |

**Parallelism.** C1 (Aaron) and C2 (Ben) run in parallel after C0. C3/C4 consume
Ben's C2 components — Aaron builds against the current mock-state versions and
integrates the new states when `design` → `main` lands. C5 needs C4 **and** the
profile/library decision. C6 last.

### App-side build (Ben, `design`, 2026-06-03) — C2 done + C3 advanced

> **⚠️ Partially superseded 2026-06-04.** Two of this session's calls were
> reversed — the per-source **Rec toggle was removed from the dashboard**
> (recording is now a single Record button on the stream view), and the
> **headless dashboard broadcast was replaced** by Go Live navigating to the
> stream view (which auto-goes-live). The component inventory and the rest of
> this section still stand. See **Updates — June 2026 (Record moves to the
> stream view…)** near the end of this file for the current model. Inline
> markers below flag the two reversed bullets.

Ben built the Go Live & Record dashboard end-to-end this session on `design`,
which **advances into what the split scoped as Aaron's C3** (`DashboardScreen`
assembly). Flagged here so Aaron doesn't rebuild it and the `design → main`
merge is coordinated. Two model refinements Ben made this session:

- **One commit button, not two.** *(⚠️ Superseded 2026-06-04: the Rec toggle was
  removed from the dashboard — it arms Air only; recording moved to a Record
  button on the stream view. The single Go Live button remains, but no longer
  has a "START RECORDING" mode.)* The per-source Air/Rec toggles are the single
  source of truth (set-it-and-forget-it); a single docked **Go Live** button
  commits whatever they say and never flips them. The `Toggle` primitive gained
  an **`armed`** state (on-position, outline-not-fill) so an on-but-not-yet-live
  toggle reads as "cued"; on commit it fills accent. The button reads
  "GO LIVE" when anything is aired or "START RECORDING" when only Rec is armed.
  The underlying **two source sets** (per-source broadcast + record) are
  unchanged — this is purely the app-side control surface; the backend payload
  (air set + record set) is identical. (Supersedes the "Two independent buttons"
  line in *Capture model* above for the app UI.)
- **Any armed source can go live → data-only streams.** Going live no longer
  requires camera/audio. Any armed source (Air or Rec, any kind) enables the
  button — a location-only share, a telemetry feed, a torch channel (morse), or
  a record-only "jog route, post later" session are all valid. `useMediasoup`
  now skips `getUserMedia` when no camera/audio is armed (it throws on
  video:false + audio:false) and produces no AV tracks; the room is still live.

What shipped on `design` (all token-clean, in galleries, DESIGN.md Section 3):
- **Components:** `FeedRow` two-affordance (Air/Rec, consent gate, `trailing`
  slot, `live`/armed) · `FeedThumb` (+ speed/torch/temp/motion glyph kinds) ·
  `ArmButton` (built, now unused after the single-button refinement) ·
  `RecordConsentSheet` · `BroadcastStatusIndicator` · `Toggle.armed` ·
  `GoBar` label/knob overrides.
- **DashboardScreen** (`screens/` — normally Aaron's lane; Ben's call this
  session): full 11-source suite, Divider-grouped (identity/location ·
  cam/audio/screen · compass/gyro/motion/speed/temp · torch), all interactive;
  Identity as a FeedRow with an inline Public/Anon segment (label; the
  flag concept is still "attributed / anon"); location
  precision ceiling; RecordConsentSheet on sensitive-record; sticky title (top)
  + sticky GoBar (bottom). Carries `air` / `record` / `identity` / `precision`
  forward in the go-live params.
- **StreamScreen**: shows `BroadcastStatusIndicator` while recording.
- **`useMediasoup`** (`hooks/` — normally Aaron's lane): graceful no-AV broadcast.

Not done (still C2/C4): `LayerEditorRow` not-captured + delete-permanently
states (clip-editor work).

**Sensitivity friction removed for now (2026-06-03, late).** The
SENSITIVE/BENIGN badges, the Rec consent lock-hint, and the
`RecordConsentSheet` disclaimer are disabled on the Dashboard — Rec flips
directly for every source. This **temporarily relaxes the "nothing
recorded silently" guardrail** below (the consent step is the part
removed; the on-air-vs-recording indicator stays). `RecordConsentSheet`
remains a shipped feature for when consent returns — re-enable before any
non-friends-and-family exposure. See DESIGN.md decision log.

**Headless broadcast on the dashboard (2026-06-03, late).** *(⚠️ Reversed
2026-06-04 — Go Live now navigates to the stream view, which auto-goes-live;
the dashboard no longer broadcasts in place. The paragraph below describes the
retired headless approach.)* Go Live now
starts/stops the stream **in place** on the dashboard (reusing
`useSignaling` + `useMediasoup`) — no navigation to `StreamScreen`. The
armed toggles flip to live and the button becomes STOP STREAM. Caveats:
no preview/viewer-count/chat/recording on the dashboard; the armed set is
locked while live; AppState background stops the stream; the singleton
`signalingClient` is shared with the never-unmounted StreamScreen (the
`navigatingRef` guard prevents spurious nav on stop; can't view +
broadcast at once). StreamScreen still owns viewing + the rich
broadcaster UI; its `isNew` broadcaster path is just no longer reached
from the dashboard. **Needs on-device testing.** See DESIGN.md decision
log for the full caveat list.

### Backend follow-ups this build assumes (Aaron / mediasoup)

The app UI is open ahead of the backend. To make it real:

- **Non-AV layer producers.** A location/telemetry/torch stream goes *live*
  today but transmits no data — viewers get a live-but-empty room. mediasoup +
  backend need to carry the aired non-AV layers (the `air` param already lists
  them) as data so viewers receive them. This is what makes friend-location-
  share and torch-morse actually work.
- **Data-only room support.** mediasoup should accept a send transport with zero
  AV producers as a valid live room (the app already sets it up that way).
- **Truly-private record-only.** "Record a jog route, post later" currently still
  creates a public live room with no media. A private local-record-then-post
  path (no public room) is the clip-recording flow, not the live flow.
- **Per-source record-to-disk** for the carried `record` set (the C1 substrate),
  beyond today's whole-stream recording.

---

## Time Machine initiative — model, working split & rollout (June 2026)

The "Time machine" (previously a v0.3 backlog line below) kicked off with a
first **UI version** on the globe. Ben built the front end; Aaron owns the
backend replay query. Builds on the clips substrate (surviving recorded clips
are what the past is made of).

### Model (decided 2026-06-04)

- **A running WRLD clock** sits as a long thin bar (~50px) at the very bottom,
  just above the tab bar; the bottom **drawer rides on top of it** (the drawer's
  bottom tracks the clock's animated height, so the drawer slides up to stay
  flush above the clock when it expands). *(2026-06-05: clock + drawer positions
  swapped — the clock used to ride above the drawer.)*
- **Single `offsetMs` behind the present** (0 = live). The playhead =
  `Date.now() - offsetMs`, re-evaluated every second.
  - offset 0 → reads as a live ticking clock; the globe is live.
  - offset > 0 → **real-time playback**: the playhead ticks forward at 1× from
    the scrubbed instant, and the globe replays the surviving clips/pins alive
    at the playhead as it advances. A muted, tappable **THEN** status (which
    replaces the **NOW** tag when scrubbed) jumps back to live. *(2026-06-05:
    relabelled from LIVE/PAST → NOW/THEN.)*
- **Collapsed = transparent bar over the globe (band only); expanded = a solid
  panel** (`theme.colors.bg.glassPanel` — paper80 at the drawer's 0.82 opacity)
  so the ghost dial values read clearly. The panel persists through the whole
  collapse animation (dropped only once fully collapsed) so the band's lighter
  paper doesn't flicker through mid-collapse. *(2026-06-05.)*
- **Independent of the drawer.** Interacting with the drawer no longer collapses
  the clock (like the globe) — only other UI (search / chips / cards) does. The
  clock and drawer expand/collapse independently, which gives **four planet
  positions** (clock × drawer, each collapsed/expanded): the planet's vertical
  shift is `drawer-contribution + clock-contribution`, the clock's shift
  proportional to its growth vs the drawer's. *(2026-06-05.)*
- **Six spinnable fields** — YR · MO · DY · HR · MIN · SEC. Each
  ticks/carries correctly (native `Date` arithmetic — spinning MIN past 00
  rolls the hour, month past JAN rolls to DEC + drops the year, etc.). **The
  carry is intentional** (Ben likes it) — the wheels are *not* independent.
  The only cross-wheel reset is dialling **forward past now**, which snaps the
  whole clock back to live. Collapsed = just the ticking centre value (clipped
  to the band, no peeking neighbours); tap to expand shows ghosted neighbours
  above/below and enables per-field vertical drag to scrub. Can't scrub into
  the future (clamped at now, future cells greyed) or before `minYear`.
- **Accepted caveat:** the past experience is thinner than live — only
  *surviving clips*, not everything that was aired. That's fine.

### Working split (Ben / Aaron)

- **Ben (`design`) — UI, done (v1 + refined).** `TimeScrubber` feature
  (`src/components/features/discovery/TimeScrubber.tsx`) + gallery entry; wired
  into `GlobeScreenMapbox` as the overlay above the drawer; globe holds
  `timeOffsetMs` state and a clearly-commented **TIME MACHINE SEAM** at the
  discovery data source. Refined since v1 (all on `design`): animated dial
  slide per tick/scrub; one band-only `bg.glass` surface between two lines
  (no gradient); equal centred wheel gaps with the colons mid-gap; fixed
  field widths (no reflow on value change); future cells greyed; LIVE(accent)
  / PAST(tap-to-live) status; bold centre value when focused; generous
  `HIT_SLOP`; a 500 ms hold after a past-scrub release before playback
  resumes (live ticks immediately); and **blur+collapse on any outside UI
  touch** via a `collapseSignal` prop the globe bumps from `onTouchStart` on
  every overlay group *except* the `MapView` and the scrubber. Full detail in
  [DESIGN.md](DESIGN.md) (TimeScrubber Section 3 + decision log).
- **Aaron (`main`) — backend replay.** At the seam in `GlobeScreenMapbox`
  (line ~146): when `timeOffsetMs > 0`, swap `useDiscoverySocket()` for
  `useHistoricalClips(playheadMs)`. Globe replays surviving clips as the
  playhead advances. Tap → clip viewer with seek. See "Backend contract" below.

### Backend contract (decided 2026-06-04)

**Unified `DiscoveryPin` type** — replaces `DiscoveryStream` as the globe's
pin shape. Discriminated union so live and historical items share one renderer:

```ts
type DiscoveryPin =
  | { kind: 'stream'; /* all existing DiscoveryStream fields */ }
  | { kind: 'clip';   id: string; recordingId: string; title: string | null;
      lat: number; lng: number; locationPrecision: 'exact' | 'city' | 'country';
      host: { id: string; handle: string; displayName: string; avatarUrl: string | null };
      seekOffsetSec: number; clipStartMs: number; clipEndMs: number;
      subscribersOnly: boolean; }
```

`DiscoveryHandoffCard` gets a `kind` discriminant: shows "Watch" CTA for
clips (navigates to `/(app)/clips/[id]?seekSec=N`) vs "Join" for streams.
Pin renderer (CircleLayer/SymbolLayer/location-precision halos) is unchanged —
same fields, same visual rules.

**`useHistoricalClips(playheadMs: number)`** — TanStack Query hook, stale 5s,
calls `GET /clips/discover?at=<ISO>`. Disabled when `playheadMs` is 0 (live).
Re-fetches automatically as the playhead advances (the playhead ticks every 1s
so the query cache naturally refreshes on staleness).

**New app route: `/(app)/clips/[id].tsx`** — clip viewer screen. Accepts
`seekSec` query param. Plays the clip's HLS `manifestUrl` seeking to
`seekSec` on load. Similar structure to `stream/[id].tsx` viewer path but
for recorded content; no WebSocket, no live viewer count.

**Location precision on historical pins** — uses `stream.locationPrecision`
(set at go-live, immutable), NOT the user's current `User.locationPrecision`.
This preserves the broadcaster's privacy choice at the time of recording.
Fallback when null: `'exact'` (not the user's current setting). Clips where
the stream was `'off'` are excluded entirely — same rule as the live feed.
Future: when `Clip.locDisplayPrecision` is added (C4 clip editor work), the
globe uses `clip.locDisplayPrecision ?? stream.locationPrecision` instead.
> ⚠️ **Superseded 2026-06-13** (see CONTENT.md §1.4 / §7 / §8): precision is **no
> longer immutable** — replay/globe read the clip's **current** `locDisplayPrecision`
> (creator can blur OR sharpen anytime); the platform retains exact coords so
> sharpening is possible. `off` excludes from discovery only while set to `off`.

**Seek offset** — computed server-side as
`T_sec − (recording.startedAt_unix_sec + clip.startSec)`, where T is the
playhead at tap time. Always within `[0, clip.endSec − clip.startSec]`
because a pin only exists at T when `clipStart ≤ T ≤ clipEnd`.

### v1 UI notes / open

- Direction: drag-down = newer, drag-up = older (wheel physics, newer above).
  Trivially flippable if it reads wrong on device.
- `minYear` defaults to **10 years back** (`DEFAULT_MIN_YEAR`) so the YEAR
  wheel has room to spin — the real data floor (WRLD launched 2026) is the
  backend's call; pass `minYear` to override once the earliest clip date is
  known (query `MIN(recording.startedAt)` from the discover endpoint or a
  dedicated endpoint).
- **Needs on-device testing** — gesture feel (the `HIT_SLOP` sizes, the tap
  vs drag threshold), the drawer-tracking position, and the
  blur-on-outside-touch (relies on `onTouchStart` bubbling to the `box-none`
  overlay wrappers).

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

- **Time machine.** Earlier states of WRLD — replay the globe at a past
  instant from surviving clips. **Kicked off June 2026** — see the "Time
  Machine initiative" section above (UI shipped on `design`; backend replay
  query is Aaron's seam). Distinct from a single broadcaster's clip history;
  built on the v0.2 recording substrate with different (time-indexed) access.
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
- **Capture Privacy Constitution** — a formal, user-facing statement of which
  sources are privacy-sensitive, the consent semantics for recording each
  (especially record-without-broadcast), and the durable promise that nothing is
  captured silently. v0.2 ships the working tiering + consent UX + on-air-vs-
  recording indicator (see the clips-initiative section above); formalizing it as a
  stated policy is its own pre-launch initiative.

**Planet zones — Venus for adult content:**

The concept: Earth is the default globe for general-audience streams. Venus is a
separate planet globe for adult content — users "fly to Venus" to see those streams.
Adult streams are completely invisible on Earth. This keeps the main experience
clean while giving adult creators a real home.

- **Why a separate planet works UX-wise.** It's a hard, memorable boundary rather
  than a filter toggle. The navigation metaphor reinforces that you're entering a
  different space with different rules. The "Venus" naming is on-brand for WRLD
  without being crude.
- **App Store / Play Store reality.** OnlyFans has no app on either store — their
  platform is web-only (PWA) by necessity, not choice. This is the clearest industry
  signal: adult content as a primary use case is effectively incompatible with App
  Store distribution. A 17+ rating gets you violence and mature themes; it does not
  get you live adult content at scale. Distribution options for Venus:
  1. **Web-only** — `venus.wrld.cam` as a PWA, completely separate from the app.
     Users who want Venus go there in a browser. Main WRLD app stays store-compliant.
     Downside: loses the native WebRTC + globe UX that makes WRLD distinctive.
  2. **Sideloaded Android only** — Android allows outside-Play installs. iOS doesn't
     without enterprise certificates. Effectively Android-only.
  3. **Skip Venus entirely** — WRLD stays general-audience. Lower legal exposure,
     no moderation overhead. Worth deciding whether adult content is core to the
     business model before investing in the infrastructure.
  4. **TestFlight / EAS dev client** — feasible for internal testing before store
     submission is a concern, but not a launch path.
  **The distribution question must be decided before any Venus work begins.**
- **Age verification.** A birthday picker does not meet legal requirements. The UK
  Online Safety Act and several US state laws require "highly effective" age
  assurance. Accepted methods include: credit card check (widely used, lowest
  friction, Stripe already has this), open banking, mobile carrier confirmation,
  government ID scan + liveness check (Stripe Identity, Veriff, Yoti), or face age
  estimation. Credit card on file is the lowest-friction defensible option since
  Stripe already processes WRLD payments — gate Venus access on a verified payment
  method. Get legal advice before launch.
- **Venus globe.** NASA/ESA Magellan radar surface data is publicly available as
  raster tiles and looks genuinely distinct from Earth. The existing Mapbox globe
  renderer (`GlobeScreenMapbox`) would be the foundation — a second globe screen
  (`GlobeScreenVenus`) with a Venus-textured style, filtered to `contentRating =
  'adult'` streams only. Navigation from Earth → Venus is a UI decision (separate
  tab, a destination you fly to, or a portal button on the globe).
- **Backend changes needed.** `Stream.contentRating String @default('general')`.
  Discovery and `findStreamsNear` filter by `contentRating`. Broadcaster dashboard
  gets a content rating toggle (gated on age-verified account). `User.ageVerified
  Boolean` to track verification status. See `wrld-backend/CLAUDE.md` v0.3 section.
- **Deferred until.** Distribution decision first. Then: age verification provider,
  legal review, and adult content moderation tooling (automated flagging + human
  review queue in the admin portal). Do not build Venus without all three resolved.

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
- **Don't scope v0.3 features into v0.2 phases.** Deferred to v0.3: real-money
  payments, subscriptions/PPV as functional features, time machine, vignettes,
  sensors beyond the seven, and public-launch hardening. (Recording/clips and
  the 7-layer sensor model were re-baselined **into** v0.2 — see the 2026-05-29
  entry and the clips-initiative section above.) See "v0.2 beta milestone" for
  the full non-goals list.
- **Don't build the clip editor on a baked / re-encoded clip model.** The decided
  model (June 2026) is a non-destructive **manifest** over per-source recording
  tracks — editing writes the manifest; permanent-delete is the only destructive
  op. See the clips-initiative section above and `wrld-backend/CLAUDE.md`.

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

## Updates — May 2026 (Phase 5/22: reports + kick handling)

### Report submission (`src/api/streams.ts`, `src/components/screens/StreamScreen.tsx`)

`streamsApi.report(streamId, reason)` calls `POST /streams/:id/report`.

In `StreamScreen` (viewer mode), a **⚑ flag button** appears next to the Tip button. Tapping it:
- Shows an `AuthModal` if not signed in
- Otherwise opens a bottom-sheet (`reportVisible` state) with four preset reasons
- On selection, calls `streamsApi.report()` → `Alert` confirmation

### Kicked by admin (`src/hooks/useSignaling.ts`, `src/lib/streamSignals.ts`, `src/components/screens/GlobeScreen.tsx`)

- WS close code **4003** in `useSignaling.ts` → calls `signalKicked()` (new signal kind `'kicked'`)
- `GlobeScreen` handles `'kicked'` signal → banner "You have been removed from this stream", auto-dismisses after 8s (same timer as `'ended'`)
- Kicked authenticated viewers are banned from rejoining the same stream for `KICK_BAN_MINUTES` (default 10, configurable from admin portal Config page). If they try to rejoin within the window, mediasoup throws `"You were removed from this stream — rejoin in X minutes"`, which surfaces in the stream error state. Anonymous viewers (no account) cannot be banned.

### Kick navigation race fix (`src/components/screens/StreamScreen.tsx`)

The original kick path set `kicked` state in `useSignaling`'s `onClose` handler, then relied on a `useEffect([kicked])` in `StreamScreen` to call `exitToGlobe('kicked')`. This was intermittently unreliable: `signalingClient.disconnect()` is called inside `exitToGlobe`, which calls `ws.close()` on the already-server-closed socket. On some platforms that dispatches a second `onclose` event (code 1006), which hits the `else` branch in the `onClose` handler and calls `setStatus('dropped')`. The `status === 'dropped'` effect fires first (before the `kicked` effect, since `status` changed in the same render), calls `exitToGlobe('disconnected')`, and sets `navigatingRef.current = true`. When the `kicked` effect finally runs, it sees the ref is already set and bails — leaving the viewer on a white screen.

**Fix:** `StreamScreen` registers its own `signalingClient.onClose` listener and calls `exitToGlobe('kicked')` directly from that callback — in the same JS event turn as the WS close, before React schedules any other effects. The `kicked` state in `useSignaling` is still maintained (for `connect()` reset), but navigation no longer goes through React's scheduler.

---

## Updates — May 2026 (Phase 17: suspension handling)

### `User` type (`src/types/index.ts`)

`suspendedUntil: string | null` and `suspendedReason: string | null` added. Both are returned by `GET /auth/me` since they're columns on the Prisma `User` row.

### Suspension banner (`app/(app)/_layout.tsx`)

`SuspensionBanner` component renders an amber stripe below the status bar on all main screens when `wrldUser.suspendedUntil` is in the future. Shows `"Your account is suspended until [date]"` for temporary suspensions, `"permanently suspended"` for permanent (year ≥ 2090). Reads directly from the Zustand auth store — no extra fetch.

### `/auth/me` polling (`app/_layout.tsx`)

`RootNavigator` polls `GET /auth/me` every 30s while signed in, updating the Zustand store. This keeps suspension status, tier, and balances current in near-real-time. Banner appears/clears within 30s of an admin action — no user interaction required.

### In-stream suspension alerts (`src/hooks/useSignaling.ts`, `src/components/screens/StreamScreen.tsx`)

`useSignaling` listens for `{ type: 'error', message: '...suspended...' }` from the mediasoup WS (sent by the server when a suspended user tries to go live, chat, or react) and sets `suspensionError` state. `StreamScreen` watches `suspensionError` via `useEffect` and shows `Alert.alert`. This is the single source of truth for in-stream suspension alerts — no stale local checks.

**What's blocked for suspended users:** go live, chat, emoji reactions.
**What still works:** tipping (mediasoup authenticates them, internal tip route has no suspension check), viewing streams (anonymous, no auth required).

---

## Known issue: push token not unregistered on sign-out

**Filed May 2026. Fixed May 2026.**

`handleSignOut` in `SettingsScreen.tsx` calls `clearWrldUser()`, clears the React Query cache, then calls Clerk `signOut()`. It does NOT call `usersApi.unregisterPushToken()` first. This means the `PushSubscription` row on the backend stays associated with the device even after sign-out.

**Consequence:** if a user signs out of account A and signs in as account B on the same device, account A's `PushSubscription` row still points to this device's token. Account A will continue receiving push notifications on a device that is now logged in as account B. The token is only cleaned up when account B calls `registerPushToken`, which upserts by token and reassigns the row to account B's userId. Until that upsert fires, there is a window where account A leaks to the device.

**Multi-account scenario (worse):** if a device is used to test multiple accounts (common for Ben and Aaron during development), old accounts accumulate stale push subscriptions that never expire.

**Fix (not yet applied):**

In `handleSignOut` (`SettingsScreen.tsx`), before calling `signOut()`:
1. Call `Notifications.getExpoPushTokenAsync({ projectId: '...' })` to retrieve the current token (the token is not persisted in the Zustand store or AsyncStorage — the easiest fix is to re-fetch it at sign-out time).
2. Call `usersApi.unregisterPushToken(tokenData.data)`.
3. Wrap in try/catch so a failed unregister doesn't block sign-out.

```ts
async function handleSignOut() {
  // Unregister push token before clearing session
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '35ab0828-46ac-477f-8ace-453105f6601e',
    })
    await usersApi.unregisterPushToken(tokenData.data)
  } catch {
    // Don't block sign-out if this fails
  }
  clearWrldUser()
  qc.clear()
  router.navigate('/(app)/globe')
  try {
    await signOut()
  } catch {}
}
```

Alternatively, store the token in the Zustand auth store when `useRegisterPushToken` fetches it, so sign-out doesn't need to re-fetch.

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

---

## Updates — May 2026 (Report snapshots: react-native-view-shot)

### New dependencies

- `react-native-view-shot@4.0.3` — captures a React Native view as a JPEG/PNG
- `expo-screen-orientation@~9.0.9` — device orientation detection

Both are native modules. **An EAS dev client rebuild is required before they work on device:**

```bash
eas build --profile development --platform all
```

### Report snapshot flow (`src/components/screens/StreamScreen.tsx`)

When a viewer taps ⚑ (Report):

1. `captureScreen({ format: 'jpg', quality: 0.9, result: 'base64', handleGLSurfaceViewOnAndroid: true })` fires immediately — before the reason sheet appears
2. The base64 string is stashed in `pendingSnapshotUri` ref
3. The reason sheet opens

After the viewer selects a reason:

1. `streamsApi.report(streamId, reason)` → `POST /streams/:id/report` returns `reportId`
2. `streamsApi.uploadSnapshot(reportId, b64)` posts the base64 to `POST /reports/:id/snapshot` in the background (fire-and-forget, non-fatal if it fails)

**Why `captureScreen` not `captureRef`:** RTCView renders on an Android SurfaceView — a hardware GPU surface outside the normal view hierarchy. `captureRef` on any wrapping View captures only the UI layer, leaving the video black. `captureScreen` with `handleGLSurfaceViewOnAndroid: true` uses `PixelCopy.request()` on Android (API 26+) which reads directly from the GPU framebuffer. On iOS, UIKit composites everything before the screenshot so it works without special flags.

**Why `result: 'base64'` not a file URI:** Axios in React Native fails silently when sending `FormData` with file URIs — the XHR layer cannot read the file before the request serialises. Capturing as base64 and posting as plain JSON bypasses multipart entirely and works reliably.

### `streamsApi` changes (`src/api/streams.ts`)

- `report(id, reason)` now returns `Promise<string>` (the `reportId`) instead of `Promise<void>`
- New `uploadSnapshot(reportId, b64)` — POSTs `{ snapshot: base64String }` as JSON to `POST /reports/:id/snapshot`

### `getUserMedia` resolution (`src/hooks/useMediasoup.ts`)

Added `width: { ideal: 1280 }, height: { ideal: 720 }` constraints to the broadcaster camera `getUserMedia` call. React Native WebRTC negotiates up to 1280×720 on supported devices (previously defaulted to ~640×352). No EAS rebuild required — pure JS.

---

## Plan — Mapbox globe replacement (pending approval, not yet implemented)

Replace the Three.js `EarthScene` + Mapbox handoff system with a single full-screen `Mapbox.MapView` using `projection="globe"` for the entire experience — from outer-space overview to street-level detail — with no seam or handoff.

### Motivation

The current architecture has two rendering layers: a Three.js canvas for the globe view and a lazy-mounted Mapbox `MapView` that fades in at close zoom. The two-layer approach introduces complexity (fade animation, `mapboxSettledRef`, `disabled` prop plumbing, camera coordinate math) and a visible transition moment. A single Mapbox globe removes all of that, and `@rnmapbox/maps@10.3.1` already in the project supports `projection="globe"`.

### Revert mechanism — one line

`app/(app)/globe.tsx` is a one-line re-export shim:

```ts
// current:
export { GlobeScreen as default } from '@/components/screens/GlobeScreen'

// after:
export { GlobeScreenMapbox as default } from '@/components/screens/GlobeScreenMapbox'
```

Changing it back is the complete rollback. `GlobeScreen.tsx` and `EarthScene.tsx` are **not modified or deleted**.

### New file: `src/components/screens/GlobeScreenMapbox.tsx`

A self-contained screen that owns the full discovery experience. No EarthScene import, no Three.js.

**Map layer:**
- `Mapbox.MapView` with `projection="globe"`, `styleURL={Mapbox.StyleURL.SatelliteStreet}`, `logoEnabled={false}`, `attributionEnabled={false}`
- Covers the full screen, no separate canvas layer needed
- Built-in pinch-to-zoom and drag-to-pan — no PanResponder required

**Stream pins:**
- `ShapeSource` with a GeoJSON `FeatureCollection` built from `useStreamsNear` data
- `cluster={true}` with `clusterRadius={50}` and `clusterMaxZoomLevel={14}` — Mapbox handles geographic grouping natively
- Two `CircleLayer`s: one for cluster dots (blue, radius scales with point_count), one for single-stream dots (accent red, fixed radius)
- `SymbolLayer` over each dot for viewer count text
- `ShapeSource onPress` handles both cluster and single taps — `feature.properties.cluster` distinguishes them; `ShapeSource.getClusterLeaves()` expands a cluster to its constituent streams for the multi-stream card

**Camera:**
- `Mapbox.Camera` ref for programmatic control
- On first valid `coords` fix: `cameraRef.current?.flyTo([coords.longitude, coords.latitude])` at zoom level ~2 (globe scale)
- Initial state: `centerCoordinate={[0, 20]}`, `zoomLevel={1.5}` (shows full globe)

**Auto-rotation:**
- `setInterval` at 80ms increments the center longitude by ~0.15° while the user isn't interacting
- `MapView onTouchStart` stops the interval; `onMapIdle` (after 4s) restarts it
- On first coords fix, auto-rotation stops and camera flies to user location

**Overlays (100% reused from GlobeScreen):**
- Banner state machine (`BannerData`, disconnected-poll, `StreamStateBanner`) — copy verbatim
- `DiscoveryHandoffCard` for single stream and cluster — same props interface
- Header (BrandMark + WRLD + LIVE count) — identical JSX
- Empty state card — identical JSX
- No `IconButton` back-to-globe needed (no handoff seam to dismiss)

### Feature parity checklist

| Feature | Three.js approach | Mapbox globe approach |
|---|---|---|
| Globe display | Custom Three.js sphere + 8K texture | `MapView projection="globe"` satellite style |
| Stream pins | DataTexture sprite pool, custom glyph rasteriser | `ShapeSource` + `CircleLayer` + `SymbolLayer` |
| Clustering | Custom O(n²) geo-cluster algorithm | `ShapeSource cluster={true}` (Mapbox native) |
| Drag/pan/zoom | PanResponder + Three.js camera | MapView built-in gestures |
| Auto-rotation | `requestAnimationFrame` + Three.js rotation | `setInterval` longitude animation |
| GPS auto-orient | First-fix sets Three.js camera theta | `cameraRef.flyTo` on first coords |
| Tap single pin | Raycaster hit-test | `ShapeSource onPress` |
| Tap cluster | Raycaster hit-test | `ShapeSource onPress` + `getClusterLeaves` |
| Street-level zoom | Fade to separate Mapbox overlay | Continuous — already in Mapbox |
| Banner | Overlay unchanged | Overlay unchanged |
| Stream card | Overlay unchanged | Overlay unchanged |

### Known visual differences from Three.js globe

- **No atmosphere glow / dark side of Earth** — Three.js added a subtle glow halo and night-side darkening that Mapbox satellite style doesn't have
- **Different pin aesthetic** — Three.js used custom DataTexture-baked circle sprites with hand-rasterised digit glyphs; Mapbox will use `CircleLayer` + `SymbolLayer` (still customisable but different look)
- **No inertia on pan release** — Three.js PanResponder had a decay inertia effect; Mapbox gestures have their own inertia model
- **Clustering algorithm differs** — custom O(n²) geographic centroid clustering is replaced by Mapbox's tile-based cluster algorithm (different grouping at edge cases)

### Files changed

| File | Change |
|---|---|
| `app/(app)/globe.tsx` | One-line swap to `GlobeScreenMapbox` |
| `src/components/screens/GlobeScreenMapbox.tsx` | **New file** — full Mapbox globe screen |
| `src/components/screens/GlobeScreen.tsx` | Untouched |
| `src/canvas/scenes/earth/EarthScene.tsx` | Untouched |

**No EAS rebuild required** — `@rnmapbox/maps` is already in the dev client. Metro hot-reload is sufficient.

---

## Updates — June 2026 (Location precision: settings + globe rendering)

### Creator location precision settings (`src/components/screens/SettingsScreen.tsx`)

Creators can now update their location visibility from the Settings screen without going through creator onboarding again. A **PRIVACY** section appears between ACCOUNT and NOTIFICATIONS, but only when `wrldUser.creatorReady` is true.

The section renders the existing `LocationGranularityPicker` (from `src/components/features/onboarding/LocationGranularityPicker.tsx`) inline — no new screen or navigation needed. Selecting a card saves immediately via `usersApi.updateLocationPrecision()` with optimistic update and revert on failure.

**Vocabulary mapping:** The picker uses `'bluedot' | 'city' | 'country' | 'private'`; the backend uses `'exact' | 'city' | 'country' | 'off'`. Two helper functions at the top of `SettingsScreen.tsx` (`precisionToGranularity`, `granularityToPrecision`) translate between them.

**Known pre-existing bug:** The creator onboarding wizard (`CreatorOnboardingScreen.tsx`) sends `'bluedot'` and `'private'` directly to `PATCH /users/me/creator-onboarding`, which validates against `'exact' | 'city' | 'country' | 'off'`. This means selecting exact or off during onboarding silently fails Zod validation on the backend. The settings screen uses the correct backend values and works correctly.

### Globe precision rendering (`src/components/screens/GlobeScreenMapbox.tsx`)

Each stream feature in the GeoJSON now carries a `precision` property (`'exact' | 'city' | 'country'`). Three distinct `CircleLayer` styles render based on this:

| Precision | Visual | Params |
|-----------|--------|--------|
| `exact` | Sharp pin | r=14, opacity=0.95, blur=0 (current behavior) |
| `city` | Soft halo | r=44, opacity=0.35, blur=0.85, stroke opacity=0.6 |
| `country` | Diffuse haze | r=72, opacity=0.25, blur=1, no stroke |

`off` precision streams are excluded server-side and never reach the client. Viewer-count labels are only rendered on `exact` pins.

The city and country halos are centered on the obfuscated/centroid coordinates returned by the backend — not the creator's real location.

### New API method (`src/api/users.ts`)

`usersApi.updateLocationPrecision(precision)` — `PATCH /users/me` with `{ locationPrecision }`. Uses the same endpoint as profile updates (displayName, handle).

### Stream type (`src/types/index.ts`)

`Stream` now has `locationPrecision?: 'exact' | 'city' | 'country'`. The `'off'` value never appears in the app since those streams are filtered by the backend before delivery.

---

## Updates — June 2026 (Creator subscriptions — app UI)

### What was built

App-side wiring for per-creator subscriptions. Payment happens on the web (system browser via `Linking.openURL`) — no IAP, no WebView — to comply with App Store rules. The app creates a short-lived checkout session via the API, opens the returned URL in the browser, and checks subscription status when it regains focus.

### New screen: `MonetizeScreen` (`src/components/screens/MonetizeScreen.tsx`)

Route: `/(app)/monetize` (registered as hidden tab in `_layout.tsx`). Entry point: Settings → ACCOUNT → "Monetize" row (only visible when `wrldUser.creatorReady = true`).

**Three states:**
1. **Not connected** — explains the 70/30 split, "Connect Stripe" button opens `POST /users/me/subscription/onboard` URL in browser
2. **Connected, no price** — enable/disable toggle (disabled until price set), price input + Save, Stripe dashboard link
3. **Connected with price** — toggle enabled, current price shown, change price, Stripe dashboard link

All mutations call the relevant `usersApi` methods and invalidate `subscription-settings` + `currentUser` query caches.

### Profile screen additions (`src/components/screens/ProfileScreen.tsx`)

When viewing another user's profile and `profile.subscriptionEnabled && profile.subscriptionPriceUsd`:
- **Not subscribed** → "Subscribe · $X/mo" button → `usersApi.createSubscribeSession(handle)` → `Linking.openURL(url)`; refetches status when app returns to foreground
- **Already subscribed** → "Subscribed · $X/mo" button (secondary style) → `Alert.alert` with "Cancel subscription" destructive option → `usersApi.cancelSubscription(handle)`

Subscription status fetched via `useQuery(['subscription-status', handle])` — only enabled when signed in, not own profile, and creator has subscriptions enabled.

### Stream screen additions (`src/components/screens/StreamScreen.tsx`)

Handles `'Subscription required'` error from mediasoup `joinRoom` separately from other errors. When viewer is blocked:
- Shows "This stream is for subscribers only" + creator handle + price
- "Subscribe" button → subscribe-session → `Linking.openURL`
- "Back" button → globe

`subscribersOnly` route param accepted (`paramSubscribersOnly?: string`). Passed as `subscribersOnly: paramSubscribersOnly === 'true'` to `createRoom`.

### Dashboard additions (`src/components/screens/DashboardScreen.tsx`)

"Subscribers only" toggle (`Toggle` primitive) shown between the Location section and GoBar — only when `currentUser?.subscriptionEnabled = true`. State: `subscribersOnly: boolean`, defaults `false`. Value passed as `String(subscribersOnly)` route param to `/(app)/stream/new`.

### Type updates (`src/types/index.ts`)

- `User` — added `subscriptionEnabled: boolean`, `subscriptionPriceUsd: number | null`
- `PublicUser` — added `subscriptionEnabled: boolean`, `subscriptionPriceUsd: number | null`
- `Stream` — added `subscribersOnly?: boolean`

### API additions (`src/api/users.ts`)

`getSubscriptionStatus(handle)`, `createSubscribeSession(handle)`, `cancelSubscription(handle)`, `getSubscriptionSettings()`, `startSubscriptionOnboard()`, `updateSubscriptionSettings(settings)`, `getSubscriptionDashboardUrl()`

### Signaling updates

`createRoom` in both `src/lib/mediasoupSignaling.ts` and `src/hooks/useSignaling.ts` now requires `subscribersOnly: boolean`. `ClientMessage` union updated accordingly.

`src/lib/activeBroadcast.ts` — `BroadcastParams` extended with `subscribersOnly?: string`.

### No EAS rebuild required

All changes are pure TypeScript/JS — no new native modules. Metro hot reload picks them up immediately.

### Activation dependency

Stripe keys must be configured in the backend before the subscribe/monetize flows work end-to-end. Until then, `usersApi.createSubscribeSession` will throw a 400 ("Stripe account not connected") which the UI surfaces as an Alert.

---

## Updates — June 2026 (Subscriptions, globe UX, offline states)

### Globe card — subscription badge (`src/components/features/stream/DiscoveryHandoffCard.tsx`)

`DiscoveryStream` type gains `subscribersOnly?: boolean` and `subscriptionPriceUsd?: number | null`.

**Single pin card:** shows a lock icon + "Subscribers only · $X/mo" when `subscribersOnly = true`, or a star icon + "Subscriptions available · $X/mo" when the creator has subscriptions enabled but the stream is open. Uses `theme.colors.accent.default` for both, in a `lockRow` flex row.

**Cluster rows:** appends 🔒 for subscriber-only streams, ⭐ for streams from subscribable creators.

### Globe pin colors (`src/components/screens/GlobeScreenMapbox.tsx`)

Pin colors now follow subscription status:
- **Single free stream** → red (`#FF3B5C`)
- **Single subscriber-only stream** → purple (`#A855F7`)
- **Cluster of all subscriber-only** → purple
- **Cluster of mixed or all-free** → red

Uses Mapbox `clusterProperties: { subscriberCount: ['+', ['case', ['get', 'subscribersOnly'], 1, 0]] }` to aggregate across cluster members. Cluster color expression: `purple if subscriberCount === point_count, else red`. The old blue cluster color (`#5B8CFF`) is retired — clusters are now the same red as singles (or purple for all-paid).

`toDiscovery` now passes `subscribersOnly: stream.subscribersOnly` and `subscriptionPriceUsd: stream.host?.subscriptionPriceUsd` through to the card.

### Subscription paywall — App Store compliance (`src/components/screens/StreamScreen.tsx`)

The old "Subscribe" button opened a Stripe checkout session via `Linking.openURL`, which violates App Store guideline 3.1.1 (in-app purchase of digital content consumed in-app). Replaced with:
- Lock icon
- Creator handle + price caption
- "Subscribe at wrld.cam to watch" informational note
- Back button only

No in-app payment flow is initiated. This is the safe pattern for both App Store and Google Play.

### Broadcaster live screen — lock badge (`src/components/screens/StreamScreen.tsx`)

When a broadcaster is live with `subscribersOnly = true`, a 🔒 icon + "LOCKED" text appears inline in the source pills row (alongside CAMERA, AUDIO badges) so the broadcaster can see the gate is active.

### Subscriber-only fix — `subscribersOnly` read from `activeBroadcast` (`src/components/screens/StreamScreen.tsx`)

The `subscribersOnly` value was being read from Expo Router route params (`paramSubscribersOnly`), which gets overwritten by the Dashboard's `useFocusEffect` recovery navigation (that navigation fires without `subscribersOnly` in its params). Fixed to read from `activeBroadcast.get()?.subscribersOnly ?? paramSubscribersOnly` instead — `activeBroadcast` is set at Go Live time and is not affected by subsequent navigations.

### Viewer disconnect on screen unfocus (`src/components/screens/StreamScreen.tsx`)

The `useFocusEffect` for viewers (non-broadcaster stream screens) had no cleanup function. When a viewer navigated away via the tab bar (rather than the in-stream back button), the WebSocket stayed open and mediasoup never received a close event — viewer count stayed at 1. Fixed by returning a cleanup from `useFocusEffect` that calls `cleanup()` and `disconnect()` on unfocus.

### Dashboard recovery navigation — `subscribersOnly` (`src/components/screens/DashboardScreen.tsx`)

The `useFocusEffect` recovery path (re-routes an active broadcast back to the stream screen on Dashboard focus) was not including `subscribersOnly` in its params. Fixed to pass `subscribersOnly: active.subscribersOnly ?? 'false'`.

### Monetize screen — subscriber stats (`src/components/screens/MonetizeScreen.tsx`)

When subscriptions are configured, shows two stat boxes above the enable toggle:
- **Subscribers** — active + past_due count from the backend
- **Est. Monthly** — `subscriberCount × subscriptionPriceUsd` in dollars

Data comes from the updated `GET /users/me/subscription/settings` which now returns `subscriberCount` and `estimatedMrrUsd`.

`src/api/users.ts` — `getSubscriptionSettings()` return type updated to include `subscriberCount: number` and `estimatedMrrUsd: number`.

`src/types/index.ts` — `Stream.host` now includes `subscriptionPriceUsd?: number | null`.

### Offline / error states

**`src/components/screens/LibraryScreen.tsx`:** The error block (`isError || isRefetchError`) now shows:
- "No connection" (body)
- "Check your internet connection and try again." (caption)
- "Your recordings and clips are safely stored online." (caption)
- "Try again" pill button calling `refetch()`

`isRefetchError` is needed in addition to `isError` because TanStack Query keeps stale cached data and never sets `isError = true` when a background refetch fails — only `isRefetchError` fires in that case.

**`src/hooks/useRecordings.ts`:** Added `retry: 1` so the error state surfaces after one retry instead of three (significantly faster offline detection).

**`src/components/screens/WalletScreen.tsx`:** Added `isError` + `refetch` to the `useWallet()` destructuring. New error block before the loading spinner shows "No connection / Check your internet connection" with a "Try again" button. Previously the wallet showed an infinite spinner when offline.

**`src/components/screens/StreamScreen.tsx`:** Added `isNetworkError(msg)` helper that matches on "websocket", "network", "connection" (case-insensitive). When the go-live or join fails with a network error, shows "No connection / Check your internet connection" instead of the raw "WebSocket connection failed" message. Non-network errors (banned keyword, suspended, subscription required) still show their specific message. Retry button relabelled "Try again".

---

## Updates — June 2026 (PPV events — app)

### What was built

Pay-per-view event management in the app. Creators schedule paid live events; viewers purchase one-time access via Stripe (same web-browser pattern as creator subscriptions, App Store compliant).

### New tab: Events (`app/(app)/ppv/`)

A dedicated **Events** tab in the bottom nav (after Me). Built as a Stack navigator so the index is always the initial screen:

- `app/(app)/ppv/_layout.tsx` — Stack (headerShown: false). Required to prevent Expo Router from matching the dynamic `[id]` segment when the tab first loads, which would render PpvEventDetailScreen with no event data.
- `app/(app)/ppv/index.tsx` → `PpvIndexScreen`
- `app/(app)/ppv/create.tsx` → `PpvCreateScreen`
- `app/(app)/ppv/[id]/index.tsx` → `PpvEventDetailScreen`
- `app/(app)/ppv/[id]/manage.tsx` → `PpvManageScreen`

### PpvIndexScreen (`src/components/screens/PpvIndexScreen.tsx`)

Creator-facing event list. Refetches on every tab focus.

- **UPCOMING** section — scheduled + live events
- **PAST** section — ended + cancelled events
- Per card: status badge, date + countdown, tickets sold, ticket price, your take (70%), duration/replay/subscriber-free tags
- Cancelled cards show a **DELETE EVENT** button (red, hairline separator). Tapping shows `Alert.alert` confirmation before calling `ppvApi.deleteEvent()`. Optimistic removal via `qc.setQueryData`.
- Cancelled cards are non-tappable (no manage screen for a cancelled event)
- Empty state with explainer and "Schedule your first event" CTA

### PpvCreateScreen (`src/components/screens/PpvCreateScreen.tsx`)

Create and edit form. Used for both new events and editing existing ones (via `?eventId` param from PpvManageScreen).

**Date & time UX** — replaced the raw `YYYY-MM-DDTHH:MM` ISO input with:
- Quick preset chips: Tonight, Tomorrow, +1 week, +2 weeks
- Separate `MM/DD/YYYY` date field + `H:MM` time field + AM/PM toggle buttons
- Human-readable preview ("Saturday, June 14, 2026 at 8:00 PM") once a valid future date is entered
- `useEffect` syncs fields when editing an existing event loads

**Fields:** Title, Description, Date & time, Duration, Capacity (optional, editable at any time — backend validates ≥ current purchasers), Price (locked after creation), Subscribers get free access (locked after first purchase), Replay access.

### PpvManageScreen (`src/components/screens/PpvManageScreen.tsx`)

Creator dashboard for a single event. Refetches on focus.

- Status badge, description, schedule details, countdown
- Stats row: Sold / Cap (or Purchasers when unlimited), Per ticket, Your earnings (70%)
- Duration, replay, subscriber-free notes
- Go Live → Dashboard button (for scheduled/live events)
- Edit event → PpvCreateScreen in edit mode
- Cancel & refund button with confirmation alert
- Loading state distinguishes "still fetching" from "query errored" (shows "Event not found" + back button on error)

### PpvEventDetailScreen (`src/components/screens/PpvEventDetailScreen.tsx`)

Viewer-facing purchase screen. Navigated to from ProfileScreen event cards.

- Tries React Query cache first (seeded by ProfileScreen), falls back to fetching via `handle` param
- Shows spinner while loading; "Event not found" + back if not found
- Once loaded: event title, host handle, description, full date, countdown ("Starts in X" or "Live now"), duration, price, replay badge, subscriber free-access note
- **Buy ticket · $X.XX** → `ppvApi.createAccessSession()` → Stripe checkout in browser
- **Access purchased ✓** state with next-step guidance (join from profile if live, notification if scheduled)
- Subscriber free access granted directly (no Stripe checkout)

### ProfileScreen additions (`src/components/screens/ProfileScreen.tsx`)

**UPCOMING EVENTS** section at the bottom of any creator's profile. Only shows `scheduled` and `live` events. Per card:
- Title + LIVE badge
- Description snippet (2 lines)
- Date + countdown
- Duration and "Free for subscribers" indicator
- **BUY TICKET** / **WATCH NOW** CTA; "✓ Access purchased" badge if already purchased
- Tapping navigates to PpvEventDetailScreen with `id` + `handle` params

### MonetizeScreen additions (`src/components/screens/MonetizeScreen.tsx`)

**PAY-PER-VIEW EVENTS** section at the bottom (always visible, regardless of Stripe status):
- Lists all creator's events (any status) as tappable cards → PpvManageScreen
- "+ Schedule event" button → PpvCreateScreen

### StreamScreen additions (`src/components/screens/StreamScreen.tsx`)

`'PPV access required'` error from mediasoup `joinRoom` handled as a separate paywall state (alongside the existing subscription paywall). Shows lock icon, "Purchase access at wrld.cam to watch", back button only — no in-app payment flow initiated (App Store compliant).

### New API module: `src/api/ppvEvents.ts`

`ppvApi` — full client for all PPV endpoints:

| Method | Notes |
|--------|-------|
| `createEvent` | `POST /ppv-events` |
| `listMyEvents(status?)` | `GET /ppv-events` |
| `getMyEvent(id)` | `GET /ppv-events/:id` |
| `updateEvent(id, data)` | `PATCH /ppv-events/:id` |
| `cancelEvent(id)` | `POST /ppv-events/:id/cancel` |
| `deleteEvent(id)` | `DELETE /ppv-events/:id` (soft delete) |
| `getCreatorEvents(handle)` | `GET /users/:handle/ppv-events` (public) |
| `createAccessSession(eventId)` | `POST /ppv-events/:id/access-session` |
| `getAccessStatus(eventId)` | `GET /ppv-events/:id/access-status` |

### New type: `PpvEvent` (`src/types/index.ts`)

Full event shape returned by all creator endpoints. Includes `netRevenueCents` and `grossRevenueCents` (computed server-side from `PPV_PLATFORM_FEE_RATE` RemoteConfig — never hardcoded in the app). `hasAccess?: boolean` on public/viewer responses.

---

## Updates — June 2026 (Events tab redesign)

### Events tab now shows all creators' events

`PpvIndexScreen` was redesigned from a creator-only management view to a global discovery feed:

- Calls `ppvApi.listAllEvents()` → `GET /ppv-events/discover` (new backend endpoint, optional auth)
- Cards navigate to `PpvEventDetailScreen` (detail/buy view) instead of `PpvManageScreen` (edit view)
- Cards show `@handle` of the creator instead of revenue stats (tickets sold, your take)
- "LIVE NOW" section for active events, "UPCOMING" for scheduled ones
- Header is "Events" with no schedule button — scheduling remains in the Monetize menu
- Empty state explains what the tab is for
- `PpvEventDetailScreen` already shows `by @handle` and the full purchase/access flow — no changes needed there

Creator management (edit, cancel, delete) remains exclusively in `PpvManageScreen`, reachable from the Monetize tab.

`ppvApi` additions:
- `listAllEvents()` → `GET /ppv-events/discover`

---

## Updates — June 2026 (PPV enforcement, overlap prevention, waiting room)

### Events tab — ACCESS badge + status-aware cards (`src/components/screens/PpvIndexScreen.tsx`)

- Green **ACCESS ✓** badge on cards where `hasAccess = true` (returned by the discover endpoint when authenticated).
- `status = live`, has access + `streamId` populated → **"Join now →"** button navigates directly to `/(app)/stream/[id]`.
- `status = scheduled`, has access → inline note "You have access — you'll be notified when it starts."
- All other states behave as before (tap → detail screen with buy button or info).

### Virtual waiting room (`src/components/screens/PpvEventDetailScreen.tsx`)

When a viewer has access to a `scheduled` event:
- A 30 s `setInterval` polls `ppvApi.getCreatorEvents(handle)` and tracks the event's `status` + `streamId` in local state (`liveStatus`).
- While `status = scheduled`: shows a spinner + "Waiting for the stream to start… checking every 30 seconds."
- When status flips to `live` and `streamId` is populated: spinner is replaced by a **"Join now →"** button pointing at `/(app)/stream/[id]`.
- Poll runs only when `isSignedIn && hasAccess && status === 'scheduled'`; cleans up on unmount/unfocus.

### Broadcaster go-live flow (`src/components/screens/DashboardScreen.tsx`)

`ppvApi.listMyScheduledEvents()` fetches the creator's scheduled events on dashboard mount (query key `my-scheduled-ppv-events`, stale 60 s). A PPV event selector row is shown below "Subscribers only" whenever the creator has at least one scheduled event:

- **Enforcement window** (30 min before `scheduledAt` through end of event): the matching event is auto-selected, the selector is locked, and a blue pill badge reads "LOCKED". The dashboard shows: `"Your event '…' is starting — this stream will be linked to it"`.
- **Outside window**: chip list lets the broadcaster pick "No event" or any scheduled event.
- `ppvEventId` is passed to `createRoom` on go-live.

### `createRoom` chain (`src/lib/mediasoupSignaling.ts`, `src/hooks/useSignaling.ts`)

`ppvEventId?: string` added to the `createRoom` message type, `MediasoupSignalingClient.createRoom()` method, and the `useSignaling` `createRoom` hook. No mediasoup changes needed — it already forwards `ppvEventId` to `POST /internal/streams/started`.

### Pull-to-refresh on the Events tab (`src/components/screens/PpvIndexScreen.tsx`, `src/components/sections/ScreenScroll.tsx`)

`ScreenScroll` gained a `refreshControl?: React.ReactElement<any>` passthrough prop (forwarded to `KeyboardAwareScrollView`). `PpvIndexScreen` wires a `RefreshControl` (accent-coloured) that calls `refetch()` on drag-down, showing the native pull indicator while in flight.

### Host's own events on the Events tab (`src/components/screens/PpvIndexScreen.tsx`)

`PpvIndexScreen` now reads `currentUser?.id` via `useCurrentUser` and compares it against `event.hostId` on each card:

- **MY EVENT badge** — accent-coloured pill shown to the left of the status badge on the host's own events.
- **Tap → manage screen** — tapping a "my event" card navigates to `PpvManageScreen` instead of the viewer detail/buy screen.
- **No viewer CTAs** — "Join now" and "You have access" notes are hidden for the host's own cards.

### Overlap prevention UI (`src/components/screens/PpvCreateScreen.tsx`, `src/api/ppvEvents.ts`)

- `ppvApi.createEvent` now returns `{ event, warning? }` (was `event` directly).
- `ppvApi.updateEvent` now returns `{ event?, warning?, ok? }`.
- On **409** `{ error: 'event_overlap' }`: Alert "Schedule conflict — overlaps with '…'". No navigation.
- On **200 + `warning: 'duration_unknown_overlap'`**: Alert "Possible overlap" shown after successful save/navigate.
- New `EventOverlapError` type exported from `ppvApi` for typed error handling.

---

## Updates — June 2026 (Record moves to the stream view; dashboard Air/Rec + headless broadcast reversed)

Reverses two earlier clips-initiative app calls (the 2026-06-03 "single
commit button" / "headless broadcast on the dashboard" entries above). The
DESIGN.md decision-log entry of 2026-06-04 is canonical.

### The model now

- **Dashboard arms Air only.** The per-source **Rec** toggle is gone from the
  dashboard — each `FeedRow` shows just the Air affordance, plus the Identity
  (Public/Anon) flag and Location precision controls. The persisted capture
  config no longer has a `rec` set.
- **Record lives on the stream view.** A single **Record** button (already
  present in `StreamScreen`) records whatever is on air; each recording becomes
  a clip in the Library. The recordings → Library pipeline is unchanged
  (`recordingsApi.start/stop`, `useRecordings`, `LibraryScreen`).
- **Go Live navigates to the stream view and auto-goes-live.** No in-place
  headless broadcast on the dashboard, and no intermediate "Start stream" step
  on `StreamScreen` — the broadcaster lands on their live page immediately.
  Data-only broadcasts (no camera/audio armed) are still allowed.

### Files changed (app, `design` branch)

- **`src/components/screens/DashboardScreen.tsx`** — removed `useSignaling` /
  `useMediasoup` / headless go-live + `AppState`/`streamEnded` stop effects and
  the `rec` state. `handleGoLive` now profanity-checks, stashes intent in
  `activeBroadcast` (incl. `ppvEventId`), and `router.push`es to
  `/(app)/stream/[id]` (`id: 'new'`) with title/sources/lat/lng/subscribersOnly/
  precision params. `canGoLive` requires any aired source. `GoBar` is just
  armed/disabled "GO LIVE" (no live/recordOnly states).
- **`src/components/screens/StreamScreen.tsx`** — broadcaster auto-goes-live in
  the focus effect (guarded via a `statusRef` so it fires on a fresh
  navigation / re-entry after a drop, but not on a plain refocus while live);
  `handleGoLive` allows empty `broadcastSources` (data-only) and forwards
  `ppvEventId` from `activeBroadcast`; on app-background the broadcaster is sent
  to the dashboard (so the "Going live…" idle frame can't get stuck); the idle
  "Start stream" arming preview + `CoordHUD` are retired.
- **`src/components/features/broadcast/FeedRow.tsx`** — new **`showRec`** prop
  (default `true`); the Rec affordance only renders when `showRec`. The gallery
  keeps both; the dashboard passes `showRec={false}`.
- **`src/lib/captureConfig.ts`** — dropped the `rec` field from `CaptureConfig`
  and the default (old persisted `rec` keys are ignored harmlessly).
- **`src/lib/activeBroadcast.ts`** — dropped `record`, added `ppvEventId`.

### Live-return bar (same day)

In-app navigation must keep the broadcast alive (only Leave / app-background /
close end it). The stream tab never unmounts, so the broadcast already survives
tab switches — the gap was getting back. Added a persistent **`LiveReturnBar`**
above the tab bar:

- **`src/stores/broadcastStore.ts`** — new Zustand store (`isLive`). `StreamScreen`
  sets it from `status === 'in-room'` (broadcaster only) and clears it on
  Leave / start-new / drop / admin-end.
- **`app/(app)/_layout.tsx`** — `Tabs` now takes a `tabBar` prop that renders
  `LiveReturnBar` above `@react-navigation/bottom-tabs`' `BottomTabBar`. The bar
  shows while `isLive` (and not already on `/stream/`), and on tap navigates to
  `stream/new` (carrying title/sources/etc. from `activeBroadcast`); the focus
  effect sees the stream still in-room and does not restart it.

The shared navigation lives in `returnToActiveBroadcast()`
(`src/lib/activeBroadcast.ts`), reused by both the tab-bar bar and the globe.

### Own stream on the globe (same day)

In `GlobeScreenMapbox`, the broadcaster's own live stream (matched by
`hostId === wrldUser.id`):

- is **excluded from the drawer** (peek rail + expanded list) and from the
  pin/cluster cards (all other curation rules unchanged);
- still shows a **pin, rendered black** (`#111111`) — an `isSelf` GeoJSON
  property feeds a `case` in the exact / city / country single-pin
  `CircleLayer`s;
- **tapping the black pin** calls `returnToActiveBroadcast()` (the same return
  link) instead of opening a join card.

**Pin numbers (same day).** Numbers on the globe are now **clusters-only** — the
single-pin viewer-count `SymbolLayer` was removed, so single pins (any
precision) show no number. The cluster count **excludes the viewer's own
stream**: a `selfCount` cluster property (sum of `isSelf`) is subtracted from
`point_count` for the displayed `cluster-count` label.

### Not yet tested on device

Auto-go-live timing, re-entry after a connection drop, the background→dashboard
navigation, the live-return bar (visual stacking above the tab bar, return nav
restoring the camera preview), and the globe self-pin (black render + tap-to-
return + drawer exclusion) all need an on-device pass.

---

## Updates — June 2026 (5-item footer + center Stream tab with live preview)

Restructures the footer to 5 items and turns the stream view into a
center-tab destination with a true pre-live camera preview. Supersedes the
tab-bar live-return bar from the section above (it's removed). The DESIGN.md
decision log (2026-06-04) is canonical.

### Footer (`app/(app)/_layout.tsx`)

Replaced the descriptor-driven `BottomTabBar` with a **fully custom 5-item
bar** (`AppTabBar`): **Globe · Dashboard · [Stream] · Me · Events**. It
navigates via the imperative `router` and highlights from `usePathname`.
Library + Wallet moved off the footer (`href:null`, reached from Me).

- **Center "Stream" item** (`StreamTabIcon`): an accent dot — **static when
  idle, two concentric rings pulsing outward while live** (`isLive` from
  `useBroadcastStore`; opacity/scale only, native driver). Tapping it calls
  `returnToActiveBroadcast()` → `stream/new` (the armed preview, or the live
  view if already broadcasting).
- The **live-return bar was removed** — the animated center icon replaces it.

### Stream view = preview + go-live (`StreamScreen`)

The broadcaster path now has two entry modes, distinguished by a `go` param:
- **Center tab (no `go`)** → **preview**: `useMediasoup.startPreview(av)` shows
  the armed camera feed **without going live**, with a shared title input and a
  **GO LIVE** button (`showCameraPreview` no longer requires `in-room`). On
  blur, the preview camera is stopped (a live broadcast keeps running).
- **Dashboard Go Live (`go=1`)** → **auto-goes-live** on arrival.

Both paths funnel through one `handleGoLive(configOverride?)` that reads arming
from **captureConfig** + coords + `activeBroadcast.ppvEventId`.
`startBroadcasting` **reuses the preview stream** (no re-prompt). The live
source set is held in `useBroadcastStore` so re-entering the tab keeps the live
view intact.

### Shared title + capture config

- `captureConfig` gained a persisted **`title`** field — now the single source
  of truth for arming **and** title, shared by the dashboard and the preview.
- `DashboardScreen`: title binds to captureConfig (loads on **focus** so it
  reflects preview edits; auto-saves with the rest). Go Live persists config,
  sets `activeBroadcast` (just `ppvEventId`), and navigates to `stream/new?go=1`.
- `activeBroadcast` trimmed to `{ ppvEventId }`; `returnToActiveBroadcast()`
  just opens `stream/new`. `useBroadcastStore` now holds `{ isLive, sources }`.
- `MeScreen` gained **Wallet** + **Library** buttons.

### Not yet tested on device (this change)

Center-tab preview (camera feed pre-live, title input, Go Live reusing the
preview stream), the animated center dot/rings, dashboard `go=1` auto-go-live,
library/wallet via Me, and whether the footer crowds the dashboard GoBar or the
live stream's bottom overlays.

---

## Updates — June 2026 (Shared Go Live / Record control; live + recording lifecycles)

The DESIGN.md decision log (2026-06-04) is canonical. Go Live and Record are now
a **single shared control** — same buttons, same state, on the dashboard and the
stream view.

### `GoLiveRecordBar` (`src/components/features/broadcast/GoLiveRecordBar.tsx`)

Two matched side-by-side buttons; state from `broadcastStore`:
- **Go Live** (idle) → **End Stream** (live)
- **Record** (idle) → **Stop Recording** (recording)

Semantics: Go Live = stream only · Record = stream + record · Stop Recording =
record off, stream stays · End Stream = both off.

### Lifecycle

- **Room is created on Go Live** (`createRoom` in `handleGoLive`), never on
  navigation — the center tab only starts a local preview.
- **End Stream stays on the page** — stops the broadcast and drops back to the
  armed preview (`handleEndStream`, no navigation). The header back arrow leaves
  to the globe but keeps a live broadcast running; only End Stream / background /
  close stop it (`handleBack` no longer tears down for the broadcaster).

### State + cross-screen control

- `broadcastStore` gained `isRecording` + a one-shot `command`
  (`endStream` / `startRecording` / `stopRecording` + nonce). The dashboard's
  buttons act on the **mounted** StreamScreen's running broadcast via `command`
  when live, or navigate (`stream/new?go=1`, `&rec=1` for Record) when idle.
- `StreamScreen`: `handleToggleRecording` split into `startRecording` /
  `stopRecording`; a `pendingRecord` ref starts recording once `streamId`
  resolves after a go-live-and-record; a `command` effect executes dashboard
  commands; `isFocusedRef` prevents End-Stream-from-dashboard from turning the
  preview camera on in the background.
- `DashboardScreen`: `GoBar` → `GoLiveRecordBar`; reads `isLive`/`isRecording`
  from the store; `startBroadcast(record)` navigates with `go`/`rec`.

### Follow-up

`GoLiveRecordBar` isn't in the feature gallery / Section 3 register yet. Also
needs an on-device pass: button parity across screens, go-live-and-record
timing, End-Stream-stays-on-page, and the dashboard commanding a live stream.

---

## Updates — June 2026 (Broadcaster live view: overlay layout + circular record)

DESIGN.md decision log (2026-06-04) is canonical. The broadcaster's live
`StreamScreen` now floats its UI over the camera (no boxes):

- **Top-left cluster** (in the header, replacing the back button): `LivePill` +
  identity chip + tappable viewer count. The translucent black box
  (`roomInfoOverlay`) is **viewer-only** now.
- **No back button** for the broadcaster (leave via the tab bar / End Stream).
- **Camera/audio pills + `BroadcastStatusIndicator` removed** from the live view.
- **`RecordCircle`** (inline component) above the End Stream button: off = light
  accent-tint circle + red dot (ghosted), recording = solid red + white stop
  square; wires to the existing `startRecording`/`stopRecording`.
- **Reaction rail** moved higher on the right (`bottom: '38%'`).
- **End Stream button** sits at the dashboard Go Live button's screen-bottom
  offset (shared `FOOTER_DROP = 30`) so it doesn't jump between pages.

The earlier "GoLiveRecordBar not in gallery" follow-up is **done** (it was added,
then trimmed to the single two-state button). `RecordCircle` is inline for now —
promote to `features/broadcast/` + gallery if it sticks. Needs an on-device pass
(over-camera contrast, record circle, button alignment between pages).

---

## Updates — June 2026 (Buffer-trim clip editor BUILT — handoff to Aaron)

The app-side buffer-trim clip editor is built and merged to `main`. This is the
clean handoff point: **C1 (substrate) is Aaron's and already done; C2 (components)
+ the app scaffold are Ben's and now done.** What remains is backend wiring.

### Built (Ben, `design` → `main`, 2026-06-06)

**C2 component library** (`src/components/features/clip/` + one primitive), all
token-clean, in the galleries, in DESIGN.md Section 3:
- `BufferTimeline` — collapsed-gap timeline; **tap-to-position playhead · one-finger
  pan · two-finger pinch-zoom (continuous) · off-screen-capable playhead** (no axis
  row); bracket drag + saved-region no-overlap clamp. PanResponder multitouch.
- `GapMarker` · `SavedClipRegion` · `ClipBracket` (overlay; parent owns time math)
- `BufferScrubField` — full-bleed swipe-to-scrub field (no on-field clock/playhead)
- `SavedClipRow` — Library row, collapsed → inline-expand player + actions; gained
  `tags?` / `onKebabPress?` / `showPlayGlyph?` so it also serves the recordings Library
- `ClipSourcesDrawer` — BottomSheet + StreamTile grid (active/inactive per source)
- `TimelineScrollbar` — thin scrollbar under the timeline (thumb length = zoom, drag
  to pan); **replaced the `TimelineZoomControl` toggle**, which was removed.

**Screens:**
- **`ClipEditScreen`** — new route `app/(app)/clip-editor.tsx`, reached from
  **Me → Clip editor**. `PageTabs` pager (Editor ↔ Saved clips). The time-machine
  **`TimeScrubber` is overlaid at the field bottom as the buffer clock** — expand to
  spin-scrub the buffer; the field swipe and the timeline scrub drive the **same
  `offsetMs`** (0 = live head, 1s tick). Field + timeline are full-bleed.
- **`LibraryScreen` reskinned** to `SavedClipRow` over the real recordings list
  (`useRecordings` / `recordingsApi` **unchanged**); all prior states preserved.

**⚠️ Runs on a MOCK SEAM.** `ClipEditScreen`'s `useMockBuffer()` is local stub state
(segments / saved regions / sources); save/delete/publish are in-memory. The
component props are already shaped for the real data.

### Remaining — Aaron's lane (backend + screens/hooks/api)

1. **Wire the `ClipEditScreen` MOCK SEAM to real data** — replace `useMockBuffer`
   with real hooks (buffer segments, saved-clip regions, recorded source layers);
   real save (write the non-destructive manifest), delete, publish.
2. **Manifest `Clip` model** — replace the legacy baked `processClip` with the
   decided non-destructive manifest over recording/buffer tracks (the C4 backend).
3. **R2 — `GET /auth/me` dual-pool** (`usedStorageBytes` + `bufferSizeBytes` +
   `bufferEarliestAt`) → feeds the field's reach hint + `BufferWindowLabel` + the
   Library storage display.
4. **R3 promote-on-publish** + **R5 read-time `index.m3u8` stitch + buffer playback
   access control** (per wrld-backend CLAUDE.md).
5. **Reconcile** the editor's mock "Saved clips" pager page with the real Library
   (does saving route into the real Library; does the Library list clips vs
   recordings?).
6. **Gyro/compass** `*Update` handlers in mediasoup (when the app emits them).

### Open / follow-ups
- **Buffer video records sideways — CAPTURE fix, NOT app-side (Aaron, mediasoup).**
  The scrub-field video plays rotated 90° in the portrait app because the recording
  is encoded landscape (WebRTC CVO orientation isn't baked by the sidecar's
  `-c:v copy`). The field + player are correct — **do NOT rotate in
  `BufferScrubField` / the `VideoView`** (would double-rotate once capture is fixed).
  Handoff note + fix in `wrld-mediasoup/CLAUDE.md` (2026-06-06).
- **Scrub-field video playback (step 1, done 2026-06-06).** `ClipEditScreen` has a
  scrub-aware throttled seek controller (pause + coalesced seeks while scrubbing,
  play forward on settle; 1s tick no longer drives seeks). Tunables
  `SEEK_THROTTLE_MS` / `SCRUB_IDLE_MS` want an on-device pass.
- **Timeline gestures → react-native-gesture-handler (2026-06-06). ⚠️ NEEDS AN EAS
  REBUILD** (RNGH `~2.28` is a native module — rides Aaron's pending `expo-video`
  rebuild). `GestureHandlerRootView` added at the app root. `BufferTimeline` now uses
  RNGH `Tap` (place playhead) + `Pan` (`activeOffsetX`/`failOffsetY` → horizontal-only
  scrub, vertical → page scroll) + `Pinch` (UI-thread zoom via reanimated shared
  values); bracket handles are RNGH `Pan` (`.blocksExternalGesture`). **Drag = scrub
  the playhead** (not scroll — scroll is the scrollbar). Replaced the PanResponder
  approach (flaky pinch / unreliable tap). Not device-tested.
- **Playhead holds, except at 'now' (2026-06-06).** `ClipEditScreen` playhead is an
  absolute held instant + `following` flag (advances only at the live edge); fixes the
  "playhead drifts/jumps after placing" behavior. `TimeScrubber` gained
  `playback?: boolean` — editor passes `false` (controlled hold); globe keeps `true`.
- **Not yet device-tested** — the whole editor (gesture feel, the six-wheel clock
  fitting full-bleed, playback-after-scrub) needs an on-device pass.
- The **seam discipline holds going forward**: Ben owns `primitives/`/`features/`/
  `sections/` + DESIGN.md; Aaron owns `screens/`/`hooks/`/`api/`. The 2026-06-06
  scaffold crossed into screens at Ben's direction for testability — Aaron owns it
  from here.

---

## Updates — June 2026 (Clip editor wired to the real buffer — R5 app seam)

Aaron took the `ClipEditScreen` **MOCK SEAM** (the `useMockBuffer` stub Ben left for
the C1/C4 lane) and wired it to the **real rolling buffer**, then pivoted the scrub
field from a still poster to **live HLS video** (Aaron's call, 2026-06-06). The
screen still composes Ben's C2 components.

- **New `src/api/buffer.ts`** — `bufferApi.getMine()` → `GET /buffer/me` (owner-gated
  rolling buffer; see `wrld-backend` R5 update). Returns `{ earliestAt, latestAt,
  windowHours, sessions[] }`; each session has `kinds`, `playableKind`,
  `manifestUrl`, `thumbnailUrl` (all tokenized). `bufferApi.saveClip()` →
  `POST /buffer/me/clips` (R3 — backend returns **501** for now).
- **New `src/hooks/useBuffer.ts`** — TanStack query `['buffer','me']`, stale 30s.
- **`ClipEditScreen` seam swap:** `useBuffer()` drives
  - the **timeline segments + collapsed gaps** (sessions → `{id,startMs,endMs}`; the
    live session's `endMs` tracks the live head via the existing 1s tick),
  - the **scrub field frame** — see the video note below (poster `thumbnailUrl` is
    the fallback; `variant` camera/audio-only/map-only from the session's `kinds`),
  - the **recorded-source list** — seeded once from the union of captured `kinds`
    (`KIND_META`/`KIND_ORDER`, defaults cam/aud/loc on); user toggles preserved,
  - `reachLabel` from `windowHours`.
- **Live video in the scrub field (supersedes the thumbnail-only field).**
  `BufferScrubField` gained an optional **`frameSlot`** (a full-bleed frame layer
  rendered behind its chrome — the design component stays player-free). The screen
  passes an **`expo-video` `VideoView`** there, bound to a `useVideoPlayer` that
  `replace()`s to the camera session under the playhead and is **paused + seeked**
  to the scrub position (the tokenized HLS authorizes itself — no Clerk header on
  segment fetches). Audio-only/map-only → no `frameSlot`, the field shows its
  fallback. **`expo-video` is a native module → an EAS dev-client rebuild is
  required** (`app.json` plugins gained `"expo-video"`). Until the rebuild lands the
  field falls back to the poster/placeholder.
- **Owner-only by construction.** `GET /buffer/me` is Clerk-gated to the caller, so
  the editor only ever shows the signed-in user's footage; tokens encode the userId
  and paths are namespaced `buffers/<userId>/`.
- **Saved-clip persistence is still R3.** `savedRegions`/`savedClips` start empty and
  saving stays **in-session** (local) until the promote-on-publish backend route
  lands — the Save button calls `bufferApi.saveClip` which 501s today.
- Entry point unchanged (Me → Clip editor; route `app/(app)/clip-editor.tsx`).

**Status:** seam wiring `1d10fab` + live-video pivot `4f71974`, pushed to `main`.
**Still owed:** EAS dev-client rebuild (expo-video); an on-device pass (real video
scrub feel, tokenized HLS/poster through Caddy, the timeline against a live growing
session); and **R3** so clips actually persist.

---

## Updates — June 2026 (Location precision is now per-stream only)

**Supersedes the account-level location precision** described in the "June 2026
(Location precision: settings + globe rendering)" section above. Precision is now
chosen **per go-live in the dashboard** (`captureConfig.precision` → `createRoom` →
`Stream.locationPrecision`); there is no user-level default.

- **CreatorOnboardingScreen** — removed the `precision` step (the
  `LocationGranularityPicker` granularity picker) and its `'bluedot'/'private'`↔
  backend mapping. The onboarding steps are now overview · (handle) · age · avatar ·
  location-permission · notif · camera · tos · done. (This also fixes the old bug
  where onboarding sent `'bluedot'`/`'private'` and silently failed backend Zod
  validation.)
- **`src/api/users.ts`** — removed the dead `usersApi.updateLocationPrecision`
  (the Settings PRIVACY section that called it was already gone) and the
  `locationPrecision` field on `saveCreatorOnboarding`.
- **`src/types/index.ts`** — removed `User.locationPrecision`. The per-stream
  `Stream.locationPrecision` type is unchanged.
- **Unchanged (per-stream):** `DashboardScreen` EXACT/CITY/COUNTRY/PRIVATE selector,
  `StreamScreen` go-live, `captureConfig.precision`, `mediasoupSignaling.createRoom`,
  and globe pin rendering by `stream.locationPrecision`.
- `LocationGranularityPicker` remains a library component (used by the dev
  FeatureGallery) but no longer drives any user-level setting.

Backend dropped `User.locationPrecision` in the same change — see
`wrld-backend/CLAUDE.md` "Location precision is now per-stream only".

---

## Updates — June 2026 (Buffer viewer: scrub feel, zoom toggle, video seek hardening)

App-side polish + a real robustness fix on the clip editor's buffer viewer, all on
`design`, all pure JS (no native change — hot-reload, no rebuild). Three files:
`BufferScrubField`, `BufferTimeline` (features), `ClipEditScreen` (screen).

### Field scrub is now zoom-relative (and slower)
Dropped the fixed `FIELD_MS_PER_PX`. The field's scrub rate is derived from the
timeline's live zoom: the timeline scrubs **1:1 with the finger** (1px = `1/pxPerMs`
ms) and the **field is exactly half that**, so the experience is consistent at every
zoom — zoom in → the field scrub gets slower/finer; zoom out → coarser. `BufferTimeline`
reports its zoom up via a new **`onZoomChange(pxPerMs)`** prop; `ClipEditScreen` holds
it in a ref and applies `0.5 / pxPerMs`.

### Gaps condensed to a quarter-screen
Scrubbing the field over a gap now traverses the **whole gap in 0.25 × fieldWidth px**
at any zoom (`msPerPx = gapDuration / quarterScreen`), so you never scrub through the
full wall-clock value of a gap — the clock spins evenly across it (longer gap → faster).
`ClipEditScreen.gapAt(ms)` finds the gap; field width comes from an `onLayout` ref.

### Zoom-level toggle re-added (All · Days · Hours · Min · Sec)
A `SegmentedToggle` below the `TimelineScrollbar`, as a non-pinch way to set zoom. Each
level snaps `pxPerMs` to a target span and re-centres on the playhead; the highlighted
segment tracks the current zoom (pinch + toggle stay in sync). `maxPx` was raised so the
finest (Sec) level — and pinch — is reachable even on a multi-day buffer (the old 12×
cap was too shallow for a 24h+ buffer).

### NOW catches up the clock
The clock derived its offset from `Date.now() - playheadMs`, which drifts up to ~1s
between ticks and read **THEN** even at the live head. When **following**, the clock
offset is now pinned to exactly `0` (reads NOW + live-ticks). Tapping NOW sets
`following`, so it catches up — to the live stream if streaming, or the trailing
"since last broadcast" gap counter if not.

### Play/pause button in the viewer
`BufferScrubField` gained a centered play/pause button (`playing` / `onTogglePlay`);
its PanResponder no longer claims touch-start so taps reach the button. Play runs from
the paused playhead and the playhead follows the video (250ms); any scrub pauses it.

### Video seek hardening (the "viewer stalls after some use" bug) — app lane FIXED
On-device logs pinned two distinct failures:
1. **Seek-hang (app bug, FIXED).** Zero-tolerance `player.currentTime = x` precise
   seeks hang AVPlayer/ExoPlayer in `loading` forever on a `-c:v copy` HLS VOD after a
   variable number of seeks (saw 20/45). **Fix:** scrub seeks now use tolerant
   `player.seekBy(delta)` (keyframe) — frame accuracy isn't needed (clip in/out come
   from the timeline). This alone took it from ~20 to 115+ clean seeks.
2. **"resource unavailable" after ~minutes (SUBSTRATE — Aaron).** The tokenized
   concatenated buffer VOD itself goes unavailable; a fresh `GET /buffer/me` token does
   **not** restore it. Handoff written to `wrld-backend/CLAUDE.md` (stacked-work item 5:
   token TTL / reaping / live-concat).

**Recovery controller** (`ClipEditScreen`), all in our lane and graceful:
- Status-gated **backpressure** — only seek when `readyToPlay`, always to the latest
  target (one in-flight seek; newer targets overwrite the pending one).
- Preview-play during a scrub burst → single **settle-pause** on the rendered frame
  (fixes blank-on-tap without per-seek play/pause thrash).
- `statusChange` watcher: stuck-`loading` watchdog (2.5s) + on error/stuck →
  **`recoverPlayer()`** = refetch fresh token + **`replaceAsync`** (not the synchronous,
  UI-freezing `replace`), **capped 4× with exponential backoff**, budget resets on every
  `readyToPlay`. Exhausted → falls back to the **poster** with **tap-to-retry**.
- Diagnostics gated behind `__DEV__` (`vlog`) — visible in dev, stripped from prod.

**Still owed:** the substrate fix (Aaron, backend item 5) so the preview doesn't degrade
after a few minutes; an on-device pass of the new scrub feel (half-rate, quarter-screen
gap, zoom toggle) and the recovery path. Scrub/timeline/clock/zoom all keep working even
when the video falls back to the poster.

---

## Updates — June 2026 (Timeline thumbnails — real frames over the filmstrip)

`BufferTimeline` can now show **real frame thumbnails** over the sprocket filmstrip,
generated with `expo-video`'s `generateThumbnailsAsync` and rendered via **`expo-image`**
(SharedRef sources). `design` branch.

### ⚠️ Pulling this needs an EAS dev-client rebuild
**`expo-image` (`~3.0.11`) is a NEW native module.** `BufferTimeline` imports it at
module scope (and the dev gallery imports `BufferTimeline`), so a client without
expo-image **red-screens the clip editor + gallery** (`Cannot find native module
'ExpoImage'`). A `development` build (both platforms) was triggered 2026-06-06 for this.
Run `eas build --profile development --platform all` if your client predates it.
Installed via `npx expo install expo-image`; `npm ci` verified clean (no `--force`).

### How it works (seam intact)
- **Enhancement layer, not a hard dep.** Thumbnails are placed at their wall-clock
  instant *over* the sprocket cells; where a thumb is missing (loading, off-window,
  gap, dead token, gallery/mock) the **sprockets show through** — so it degrades cleanly
  with the same buffer-VOD substrate issue (backend item 5) rather than breaking.
- **Dedicated generator.** A second `useVideoPlayer` instance (muted, paused) generates
  thumbnails so it never contends with the playback player's scrub-seeks.
- **Visible-window only.** `BufferTimeline` reports its visible range + per-cell duration
  via **`onVisibleRangeChange`** (debounced 200ms); the screen generates for exactly that
  range/density, **cached by media-second**, capped 28/pass, one `generateThumbnailsAsync`
  call per pass, `maxWidth: 96`.
- **Lane:** `BufferTimeline` stays presentational (new `thumbnails` + `onVisibleRangeChange`
  props, `TimelineThumb` / `VisibleRange` types); `ClipEditScreen` owns the generator + the
  wall-clock↔media-seconds mapping.

### ⚠️ Client-side generation CONFIRMED NON-VIABLE (2026-06-06, on-device) — gated OFF
`generateThumbnailsAsync` **hangs** on the `-c:v copy` HLS buffer VOD — it never
resolves (logs `thumb gen: N cells in window` then nothing; a 6s timeout guard proves
it: `thumb gen failed after 6000ms`). Same root cause as the playback seek-hang (exact-
frame extraction), but thumbnails have **no tolerant API** to dodge it. So the client
path is gated **off** behind `CLIENT_THUMB_GEN = false` (kept, not deleted — flip true if
a future source supports it); the timeline shows its **sprocket filmstrip**.

**The real fix is SERVER-generated buffer thumbnails** (sidecar emits interval JPEGs /
sprite / WebVTT) — Aaron's lane, `wrld-backend/CLAUDE.md` stacked-work **item 6**. The
expo-image render layer + the `thumbnails` prop **stay** — when server thumbnails land
the app just feeds their URLs into the same prop (only the source changes, no rework).
The expo-image dep + the EAS rebuild requirement still stand (the module is imported
regardless of the flag).

---

## Updates — June 2026 (Buffer "resource unavailable" DIAGNOSED — codec-uniform groups + capture pinning)

Closes out the stacked-work **item 5** ("resource unavailable after a few minutes")
from the buffer-trim handoff. The 2026-06-06 note routed it to the backend as a
serving bug (token TTL / reaping / live-concat). **On-box diagnosis 2026-06-07
falsified all three** — the serving is healthy (manifest 200, all 229 segment/init
URLs 206, segments intact a day later, 6h token rotated per call). The real cause is
**the shape of the concatenated VOD**: it stitched sessions with **different H.264
codec params** (one go-live encoded level 5.2, another 4.1 — same 640×360) across
`EXT-X-DISCONTINUITY` with separate `EXT-X-MAP` inits. A mid-VOD decoder-config change
wedges native AVPlayer/ExoPlayer after a seek across the boundary, and reloading the
same mixed playlist re-wedges identically — which is why a fresh token never restored
it. Full evidence + the backend guard live in `wrld-backend/CLAUDE.md` item 5.

### App changes (this repo)

- **`src/api/buffer.ts`** — `BufferDescriptor` gains **`allGroups?: BufferGroup[]`**
  (`{ groupIndex, startSec, durationSec, sessionCount, manifestUrl }`). Each group is
  one codec-uniform HLS VOD (single `EXT-X-MAP`); `startSec` is its offset into the
  gaps-collapsed camera media timeline. `allManifestUrl` stays as a legacy fallback.
- **`src/components/screens/ClipEditScreen.tsx`** — the player is now **group-aware**.
  It plays the group under the playhead and **swaps the source at group boundaries**
  instead of relying on the single mixed `allManifestUrl`:
  - `playGroups` (from `allGroups`, or a one-group fallback over `allManifestUrl` for
    older backends); `groupForMediaSec(globalSec)` and `localForActive(globalSec)` map
    the global camera media timeline ↔ the active group's local time.
  - `activeGroupIndex` state drives the load effect (`replaceAsync` the active group's
    URL, seek to the local offset + repaint). Scrubbing across a boundary switches the
    group; playback advances to the next group when one ends.
  - `pendingSeek` / recovery / thumbnails are all local-to-active-group; the thumbnail
    generator tracks the active group so its frames stay codec-uniform (out-of-group
    instants fall back to sprockets — unchanged graceful degrade).
  - The recovery controller (capped `replaceAsync` + backoff + poster) is unchanged;
    it now refetches and reloads the **active group's** fresh URL.
- **`src/hooks/useMediasoup.ts`** — **capture is now pinned** (the root fix for the
  drift). `getUserMedia` video constraints come from a shared `cameraConstraints()` that
  reads `maxCaptureHeight(wrldUser.tier)` (`src/lib/tierCaps.ts`, G4 cap-produce) and
  sends `width`/`height` as **`{ ideal, max }`** (16:9) plus a fixed `frameRate` (30).
  Pinning `max` (not just `ideal`) makes capture deterministic across go-lives ⟹ a
  stable SPS/level ⟹ the buffer collapses to a **single group** going forward (so even
  the legacy stitch is safe). This also wires the long-intended per-tier ladder
  (720/1080/1440) that `tierCaps.ts` was written for. Disjoint from the in-flight
  ~2 Mbps produce-encodings tuning in the same file (left untouched).

### Status / not yet device-tested

Pure JS in the app (no new native module) — hot-reloads, **no EAS rebuild** for these
changes (the separate pending `expo-video` / RNGH / `expo-image` rebuild still stands).
Needs an on-device pass: group-boundary source swaps (scrub + playback across a
codec change), the capture-pinning at each tier, and that a freshly-captured buffer
now reports a single `allGroups` entry. The backend guard must be deployed for
`allGroups` to be populated (until then the app uses the `allManifestUrl` fallback).

---

## Updates — June 2026 (Buffer-trim editor: gaps, wall-clock playback, eviction edge, frames)

Clip-editor refinements on `design` (`BufferTimeline` feature + `ClipEditScreen` screen).
All pure JS — hot-reloadable, no native change. Canonical detail in DESIGN.md
(BufferTimeline Section 3 + the 2026-06-07 decision-log entry).

- **Smooth scrub over gaps (no snapping).** `BufferTimeline.timeToX`/`xToTime` now
  interpolate across the collapsed gap markers (inter-session, leading, trailing) instead
  of snapping the playhead to a clip head. The field scrub dropped its quarter-screen gap
  handling for one plain zoom-relative rate (half the timeline's 1:1 finger rate).
- **Wall-clock playback.** Playback is real-time-driven: the playhead advances by elapsed
  wall-clock (crossing gaps), the video follows (plays over footage, holds over gaps), and
  it stops only at the live edge — not at a clip end. Touches only the playback *follow*
  loop (a `playClockRef` anchor + `globalSecForWall`); Aaron's group load/play-pause/
  advance effects are untouched. **Needs an on-device pass** (gap-entry blip, in-session
  drift — there's a 0.75s correct).
- **Head/tail edge indicators (`BufferEdge`, 15px)** replace the edge `GapMarker`s:
  darkest token (`text.primary`) when idle, `accent` + a footage-facing **zigzag** when
  **head-evicting** (buffer full) / **tail-live** (streaming). Teeth = 4 evenly spaced ×
  5px deep. "All" zoom now fits the whole buffer incl. both edges (fit subtracts them).
- **Leading eviction gap** with a **"FOOTAGE CLEARS IN" countdown** (from `windowHours` +
  earliest footage; no `atCapacity` needed). Head/tail counting clocks show **d·h·m·s**
  (seconds always, ticking).
- **Real frames over the filmstrip:** per-session `posterUrl` cover-fills each segment
  (expo-image), **falling back to sprockets on load error**. The advertised
  `…/camera/thumb.jpg` poster currently **404s** server-side (Aaron — wrld-backend
  stacked-work item 6). **Client `generateThumbnailsAsync` is gated OFF** — confirmed to
  hang on the `-c:v copy` HLS VOD even on the codec-uniform groups; server frames will
  feed the existing `thumbnails` prop.
- **Layout:** the `TimeScrubber` clock sits **below** the field (not overlaid); field /
  clock / timeline are inset to align with the "name this clip" input (no full-bleed).
- `__DEV__`-gated `[clip-video]` diagnostics remain (status/recovery + poster/thumb gen) —
  zero prod impact (stripped by the `__DEV__` guard); useful until Aaron's poster endpoint
  + buffer substrate settle.

---

## Updates — June 2026 (Buffer editor: transport, tap-seek, scrub/clock pause-resume)

Second clip-editor round on `design` (`ClipEditScreen` + new `BufferTransport` +
`BufferTimeline` / `BufferScrubField` / `TimeScrubber`). All pure JS — hot-reloadable.
Canonical detail in DESIGN.md (Section 3 + the 2026-06-07 "transport, tap-to-seek…"
decision-log entry).

- **`BufferTransport`** (new feature) — a five-button row under the field, above the
  clock: beginning of buffer · prev clip · play/pause · next clip · end of buffer.
  Presentational; `ClipEditScreen` owns the jump targets (clip heads = session starts;
  beginning = the leading eviction-gap edge when present, else oldest footage; end =
  live edge). Prev/next disable at the edges. Gallery entry added.
- **Play/pause removed from `BufferScrubField`** — the transport owns it now. (Poster-
  retry-on-tap moved onto the transport's play button.)
- **Tap-to-seek vs drag-scrub** — `BufferTimeline.onSeek` (tap, keeps playing / honours
  pause) split from `onScrub` (drag).
- **Scrub + clock pause-on-grab / resume-on-lift** — timeline drag, field drag, and clock
  spin pause playback while held and resume ~250ms after lift if it was playing (intent
  carries across a burst of wheel/edge adjustments). New `onScrubStart`/`onScrubEnd` on
  `BufferTimeline`, `BufferScrubField`, `TimeScrubber` (globe `TimeScrubber` unaffected).
- **Field scrub collapses gaps** — crosses a whole gap in a small fixed finger distance
  (`GAP_SCRUB_PX`), no slowdown over long gaps; footage stays zoom-relative.
- **Smooth playback gap-rush** — the follow loop runs on `requestAnimationFrame`; the gap
  rush updates the clock every frame over a fixed 3s (`GAP_RUSH_MS`), footage throttled
  to ~200ms.
- **`BufferScrubField` → RNGH `Pan`** (was PanResponder) — same horizontal-only
  scroll/scrub arbitration as the timeline.
- **Layout** — clock sits above the transport and flush under the field; edge teeth
  finalised at 4 × 5px, 15px edges.

---

## Updates — June 2026 (Clip editor: chat source · stacked per-source timeline · bottom-shelf chrome)

Big clip-editor pass on `design`, all pure JS (hot-reloads, no native rebuild). DESIGN.md
Section 3 + galleries updated throughout. Highlights:

- **Chat source.** Dashboard gains a **Chat** row under Location (a flag — `CHAT / NO CHAT`
  multistate, same shape as Identity/Location — persisted in `captureConfig.chat`). The
  clip editor's source rail gains **Chat**; a new **`SourceChatLog`** feature renders the
  chat placeholder in the buffer viewer. New `FeedKind 'chat'` (glyph `message-circle`).
- **Stacked per-source timeline (`BufferTimeline` lanes).** One timeline per source, all
  sharing the **identical** segment/gap geometry (a clip is a recording duration → aligned
  gaps); only each segment's **fill** differs by source — new **`TimelineLaneFill`** (audio→
  waveform, telemetry→trace, location→trail, chat→ticks, flat→glyph; camera keeps the real
  filmstrip). **Expand** = all lanes stacked (detached source-icon gutter, per-lane bordered
  boxes, 4px gaps); **collapse** = just the viewed lane — both look the same. Per-lane clip
  gaps + head/tail `BufferEdge`s render **inside each lane** so the inter-lane gap breaks
  them too.
- **Two roles (decided):** the buffer-viewer **rail** picks the single VIEWED source
  (`selectedKey`); the **gutter icons are on/off toggles for clip inclusion**
  (`includedKeys` / `onToggleLane`). Trims/deletes apply only to toggled-on lanes, recorded
  per lane (`removedByLane`) and rendered as **no-data blocks** (shown for in- AND out-of-
  clip lanes). Excluded lanes dim. **MOCK seam** — the real per-lane removed ranges +
  destructive buffer mutation are Aaron's manifest.
- **Clip tools (`ClipBracket` / tools).** Select = bracket the session under the playhead;
  set-in/out land exactly on the playhead and shove the opposite point to keep a min clip.
  **Bracket can now collapse entirely** — grip bulbs moved **OUTSIDE** the frame (bulge out,
  flat inner side), so there's no min-width floor; dragging a handle to meet the other clears
  the bracket.
- **Bottom-shelf chrome.** The clip editor's bottom is now a single animated container with
  three stacked sticky shelves — **scroll/zoom · clip-tools · transport** — above the clock
  (the dashboard/stream shelf-over-clock pattern). The whole stack's `bottom` tracks the
  clock's animated height, so it **rides up when the clock expands** (same timing as
  `TimeScrubber`). The scroll/zoom bar was **extracted** from `BufferTimeline`
  (`externalScrollbar` + `onScrollbarState` + `scrollbarApiRef` → the exported
  `TimelineScrollbarShelf`) so it stays reachable above a tall expanded lane stack.
  `ClipToolRail` gained a horizontal **`shelf`** variant; `TimelineScrollbar`'s grab target
  is now the whole track.
- **Buttery, centre-locked zoom.** Tap-zoom now **ramps smoothly on the transform** (no
  instant re-layout / filmstrip re-tile = the "jump"), pinned on the viewport-centre instant,
  rapid taps accumulate. A manual zoom/scroll clears `pinnedLiveRef` so the **live-edge
  auto-follow can't yank the scroll back** (re-arms when the playhead leaves the live window).
- **Playback tap-then-play fix.** Tapping a new playhead position and playing no longer
  jumps back to the keyframe — the video-follow glue only holds the playhead during a genuine
  stall (+ a brief post-seek suppression), so it plays on from the tapped instant.

> **Seam note:** the 2026-06-06 scaffold crossing into `screens/` (Ben owns `primitives/`/
> `features/`/`sections/` + DESIGN.md; Aaron owns `screens/`/`hooks/`/`api/`) still holds —
> the `ClipEditScreen` edits here are the agreed Ben-scaffold; Aaron owns the real data
> wiring (the manifest, per-lane coverage/removed ranges, save/delete/publish).

---

## Pro analytics dashboard — port from wrld-web (DONE, June 2026)

> **Shipped.** The plan below is preserved for context; see "What was built"
> at the end of this section for the as-built result.


`wrld-web` shipped a best-in-class **Pro-only** creator analytics dashboard. The
backend endpoint is **shared and already live**, so the app port is **pure client
work — no backend or mediasoup changes.**

**Backend contract (done):** `GET /users/me/analytics?range=7d|30d|90d|all&tz=<IANA>`,
auth required, **gated server-side on `tier === 'pro'` (403 otherwise)** — mirror
the gate client-side too. Returns: `summary` KPIs (reach, unique/anon split, watch
time, streams, followers, subscribers, MRR, revenue, Space Bucks purchased, tips
received, Stardust earned), a daily `timeseries`, `geo` (countries) + `topCities`,
`topViewers` (watch time), `topSupporters` (tippers), `activity` (viewer joins by
**local** day×hour — that's what `tz` is for), subscriber health
(`cancelledSubscribers`/`netSubscribers`), `signedInReach`/`anonymousReach`/
`signedInRate`, `ppvEvents` (attendees + gross/net), and `topStreams`/`topClips`.
Full field-by-field shape: `wrld-backend/CLAUDE.md` → "Pro creator analytics +
audience-geo capture" and its four follow-ups. Audience geo (`ViewerGeo`, anon +
auth, country + city, **never the IP**) is captured by mediasoup on every join —
**forward-only, no backfill**.

**Reference implementation to mirror (`wrld-web`):**
- `src/api/analytics.ts` — typed client + all response types (sends the browser tz)
- `src/hooks/useAnalytics.ts` — TanStack query (`['analytics', range]`, Pro-gated `enabled`)
- `src/components/analytics/AnalyticsPage.tsx` — the whole dashboard (gates, range
  selector + refresh, KPI cards, Plan & storage, Space Bucks/Stardust tiles, top
  countries/cities, top viewers/supporters, activity heatmap, audience composition
  + subscriber health, PPV table, line/area/bar charts, top streams/clips)
- `src/components/analytics/CountryMap.tsx` — the Mapbox choropleth

**Port checklist (app):**
- `src/api/analytics.ts` + `src/hooks/useAnalytics.ts` — near-verbatim ports.
- New screen `app/(app)/analytics.tsx` + a Pro-gated entry point (surface from the
  Me / creator area, near Monetize). Non-Pro → upsell to `/subscription`.
- Pro gate from `wrldUser.tier` (authStore), same as web.

**RN-specific decisions — surface these before building:**
1. **Charts — there is NO chart lib in the app yet.** Web used `recharts` (web-only).
   Pick an RN chart lib: `victory-native` (Skia) or `react-native-gifted-charts` are
   the strongest; a `react-native-svg` custom build is the lightweight route. This is
   the main new dependency.
2. **Choropleth — use `@rnmapbox/maps`** (already a dep; the globe uses it via
   `ShapeSource`/`CircleLayer`). Add a `VectorSource` on `mapbox.country-boundaries-v1`
   + a `FillLayer` whose `fillColor` is a **data-driven `match`/`interpolate`
   expression keyed on `iso_3166_1`**, rebuilt when the geo data changes — RNMapbox
   has no clean `setFeatureState` like web GL JS, so drive color via the style
   expression. Apply the single-worldview filter (avoid disputed-boundary dupes),
   same as web. Mapbox token/provider already configured.
3. **Activity heatmap** — pure `View` grid (7×24), no lib; direct port of the web logic.
4. **Timezone** — the API wants an IANA tz. Use
   `Intl.DateTimeFormat().resolvedOptions().timeZone` (Hermes Intl) or add
   `expo-localization` (`Localization.timezone`); fall back to `'UTC'`.

**Caveats to preserve in the UI (same as web):** watch-time / unique-viewer /
top-viewer / top-supporter metrics are **signed-in only** (anonymous viewers have no
identity); country / city / reach / heatmap include **everyone**. All audience-geo +
activity data is **forward-only** (accrues from new viewer activity). Storage shown
is the **saved-clip pool** (`usedStorageBytes` / `storageQuotaBytes` from
`/auth/me`), not the rolling buffer.

### What was built (as-shipped)

Pure client port — no backend or mediasoup changes. Typecheck clean.

**Decisions taken (the three RN-specific ones, confirmed with Aaron):**
1. **Charts → `victory-native` (Victory Native XL, Skia).** Chosen for UX
   ceiling, not build cost: GPU-accelerated 60fps rendering + native
   press-to-inspect. Pulls in **`@shopify/react-native-skia`** (reanimated +
   gesture-handler were already deps). Both are **native modules** → a
   **dev-client / EAS rebuild is required** before charts render on device
   (`npx expo run:ios|android` or a new EAS dev build). Until then, JS bundles
   and typechecks fine; the chart Canvas just won't draw in an old client.
2. **Choropleth → shipped now** via `@rnmapbox/maps` (already a dep). Light
   style (`StyleURL.Light`, mercator) to match the app's cream theme;
   single-worldview filter; `VectorSource(mapbox.country-boundaries-v1)` +
   `FillLayer`. RNMapbox has no `setFeatureState`, so colour is driven by a
   **data-driven `match` expression on `['get','iso_3166_1']`** rebuilt
   (`useMemo`) from the geo data — one (countryCode → ramp colour) pair per
   country, NO_DATA fallback. Web's hover popup → **tap-to-select** overlay.
3. **Timezone → `Intl`** (`Intl.DateTimeFormat().resolvedOptions().timeZone`,
   `'UTC'` fallback). No new dep — Hermes ships full Intl on SDK 54. (No UX
   delta vs `expo-localization`; same IANA string either way.)

**Design adaptation:** the web dashboard is dark + multi-tint (cyan/violet/…).
This app's design system is **warm cream paper + single warm-crimson accent**,
so the port renders through the app's tokens/primitives (Card/Text/Icon/theme),
neutral icon tiles, and **crimson + amber** for data-viz (choropleth ramp,
heatmap opacity ramp, chart series, meters, the signed-in split bar). Subscriber
health uses ink (positive) vs accent-crimson (cancelled/negative) since the
system has no green/red semantic.

**New files:**
- `src/api/analytics.ts` — `analyticsApi.get(range)` + full `AnalyticsData`
  types (near-verbatim from web; sends the device IANA tz).
- `src/hooks/useAnalytics.ts` — TanStack query `['analytics', range]`,
  `staleTime 60s`, `enabled = signedIn && isPro`.
- `src/components/screens/AnalyticsScreen.tsx` — the dashboard. Three gates
  (signed-out → login; **non-Pro → upsell to `/(app)/subscription`**; Pro →
  dashboard). Range selector (`SegmentedToggle` 7d/30d/90d/all) + refresh, 8 KPI
  cards, Plan & storage (meter), Space Bucks/Stardust tiles, country map + top
  countries bars, top cities, top viewers + top supporters, audience area+line
  chart, day×hour activity heatmap (pure `View` grid), audience composition +
  subscriber health, PPV table, follower line + stacked tips/PPV revenue charts,
  top streams + clips.
- `src/components/features/analytics/CountryMap.tsx` — the RNMapbox choropleth.
- `app/(app)/analytics.tsx` — route re-export; registered `href: null` in
  `app/(app)/_layout.tsx` (Tabs navigator hides non-tab screens this way).

**Entry point:** an **Analytics** `SettingsRow` in SettingsScreen's ACCOUNT
group, right after Monetize. Shown to **everyone** (the screen enforces the Pro
gate; the upsell is the Pro marketing surface) — value text adapts for non-Pro.

**Charts note for victory-native XL:** x-axis uses a numeric index `i` (not the
date string) so the linear scale spaces points evenly; the date is looked up for
`formatXLabel`. Axis labels need a Skia font, loaded via `useFont` against the
bundled `IBMPlexMono_500Medium.ttf`. All three charts guard `rows.length === 0`
with an empty state (Victory can choke on empty `data`).

**Needs a device pass (couldn't verify headlessly):** the Skia charts (after the
dev-client rebuild) and the RNMapbox `FillLayer` `match`-expression colouring +
worldview filter. Typecheck passes and the signaling/data shapes match the
proven web path, but the Skia Canvas and the Mapbox style expression can't be
exercised in a headless typecheck.

---

## Platform hardening initiative — app slice (PLAN, June 2026)

> Master plan: `wrld-backend/CLAUDE.md` → "Platform hardening initiative (H-series)".
> The foundation work is backend-heavy; the app slice is **H3 (tests) only**, scoped
> to pure functions — the high-value correctness lives server-side.

- **`vitest` setup** (jsdom not needed for the pure-util pass). Add a small
  `src/**/__tests__` covering the **pure helpers** where a silent bug is plausible:
  - currency / unit formatters (`watchLabel`, `formatBytes`, USD/Space-Bucks/Stardust
    conversions — the `$0.01/unit` math),
  - `captureConfig` load/migrate (the `bluedot→exact` migration, defaults),
  - `tierCaps` / `maxCaptureHeight` resolution + the remote capture-ladder merge,
  - any pure money/format helper shared with monetisation screens.
- **Defer** component/integration/RN-render tests — low ROI at this stage and the
  device-pass workflow already covers the risky native paths (charts, mapbox, WebRTC).
- **CI:** include `tsc --noEmit` + `vitest` in the shared GitHub Actions gate (H3).

No native rebuild implied. Start only when the backend H-series begins; this slice is
independent and can land anytime.

---

## Updates — June 2026 (Clips landing grid shipped; saved-clip persistence → Aaron)

Ben shipped the **Clips landing grid** to `main` (`581ce6a`): a two-lane time-ordered
grid (`app/(app)/clips.tsx` → `ClipsScreen`) — buffered recording sessions (left) and
saved clips (right) on a shared vertical axis (now at the bottom), per-clip collapsed-gap
layout, pinch-to-zoom, **double-tap → editor**, **drag across lanes to save / un-save**.
Carries a shared **`[Clips | Editor]` `PageTabs`** with `ClipEditScreen` (sibling
`href:null` tab routes → instant swap). **Phase C** scopes `ClipEditScreen` to the
double-tapped clip's own window (`clipId` param → single segment, no eviction gap / live
tail, bracket defaulted to the whole clip). The **Library screen is retired** — the grid
is the saved-clips surface. New design components in DESIGN.md Section 3: `ClipBlock`,
`ClipLane`, `TimeGapMarker` (+ `ZoomButton` extracted from `BufferTimeline`; `TimeGridlines`
parked).

**Drag-to-save is NOT durable yet — handed to Aaron.** `moveClip` sets a local (ephemeral)
`laneOverride` and calls `bufferApi.saveClip` → `POST /buffer/me/clips`, which **501s**
(R3 promote-on-publish not built); on reload the clip is back in the buffer lane, and the
saved lane reads `useRecordings` (not saved clips) so a persisted clip wouldn't show anyway.
The durable fix is two backend pieces + an app-side source swap, spec'd in
**`HANDOFF-clips-saved-persistence-2026-06-11.md`**:
- **R3** — `POST /buffer/me/clips` must **promote bytes out of the rolling buffer into the
  permanent saved-clip pool** (survives eviction), returning `{ clip: { id } }`.
- **C5** — new `GET /buffer/me/clips` (list, for reload + the saved lane) + `DELETE
  /buffer/me/clips/:id` (un-save). **Open model decision (Aaron's):** saved lane = saved
  buffer-clips / recordings / both-unified (recommendation: unified with a `source` field).
- **App side (Ben, once contract agreed):** `bufferApi.listSavedClips()` + `useSavedClips()`,
  grid saved lane → `useSavedClips()`, `moveClip` → save/delete + query-invalidate (drop the
  local override). The app already calls `saveClip`; it just needs the endpoints to persist.

---

## Source visualizers initiative — audio + sensor telemetry (June 2026)

A viewer (and the live broadcaster, as a local monitor) can switch between a stream's sources and
**see a visualizer for each non-camera source** — audio waveform/orb, compass, gyro, motion,
accelerometer (3-axis), speed, temperature, torch. Camera stays video. Built so a data-only /
audio-only stream is no longer a bare panel.

**Working reference: `HANDOFF-source-visualizers-2026-06-12.md`** (cross-repo, has a START-HERE
checklist for Aaron). Split:

- **Ben (`design`) — DONE:** 8 presentational visualizers + `VisualizerFrame` + `SOURCE_META`
  (`features/stream/`), the **`SourceStage`** section (`sections/`, the kind→component "universal
  remote" — data sources render directly, camera/screen via an injected `slot`), galleries +
  DESIGN.md Section 3. **Camera + audio wired end-to-end** (crossed into `hooks/`+`screens/` at
  Ben's direction): `useMediasoup` exposes a real `audioLevel` (shared getStats poll — consumer for
  the viewer, producer for the broadcaster mic); `StreamScreen` viewer + broadcaster surfaces switch
  source via `SourceRail` (inline 2-case cam/audio today). Verified by `tsc` + Metro bundle; **owes
  an on-device pass** (audio level moving with speech; switch feel).
- **Aaron (`main` + sister repos) — TODO (telemetry data path):** mediasoup `telemetry`→
  `telemetryUpdate` relay (Option A, like `chatMessage`); advertise aired sensor kinds via
  `Stream.sources` (no new tables/endpoints); widen `SourceType` → `FeedKind`; `useTelemetryCapture`
  (broadcaster, **`expo-sensors`** → EAS rebuild); `useStreamTelemetry` (viewer) and **swap
  StreamScreen's inline switch for `SourceStage`** so sensors slot in. Decided wire contract +
  per-repo detail in the handoff. **Temp has no reliable phone sensor** — ship UI-present-but-data-
  absent or drop (decision in handoff). DECIDED contract should be mirrored into
  `wrld-backend/CLAUDE.md` + `wrld-mediasoup/CLAUDE.md`.
- **Chat harmonization (Aaron's persistent-chat work, June 2026):** chat is one of the sources —
  already shipped end-to-end on the design side (`FeedKind 'chat'`, `SOURCE_META.chat`,
  `SourceStage` `case 'chat'` → `SourceChatLog`). Aaron's persistent chat is the **data** feeding
  three surfaces from one source of truth: the live overlay, the chat source-view in the rail
  (`{ kind:'chat', messages }` → `SourceStage`, shape `{ handle, text }`), and the clip chat track
  (C6, `SourceChatLog` + `progress`). Persisting chat is what makes the clip chat track real — no
  new chat viewer needed. See the "⚡ Chat is already a source" callout in the handoff.

---

## Updates — June 2026 (Fullscreen video viewer — landscape + audio controls)

Viewers can take the live stream (and external/HLS bar cams) **fullscreen**, with
landscape rotation for landscape video and an in-app **mute/unmute** control. All
in Aaron's lane (`screens/` + `hooks/`); **no new dependency** (uses the already-
installed `expo-screen-orientation` + react-native-webrtc's per-track volume API).

### No EAS rebuild needed (no native change)

`app.json` stays `"orientation": "portrait"` and there are **no new native
modules** — so this is pure-JS / hot-reloadable. `expo-screen-orientation` has
been compiled into the dev client since May 2026 (the view-shot rebuild), and its
runtime `lockAsync` overrides the *static* config on **both** platforms:
- **Android** — `lockAsync` calls `setRequestedOrientation` at runtime, overriding
  the manifest's `android:screenOrientation`.
- **iOS** — the module auto-registers an Expo AppDelegate subscriber
  (`ScreenOrientationAppDelegate`) implementing
  `application(_:supportedInterfaceOrientationsFor:)`, which iOS uses **instead of**
  Info.plist's `UISupportedInterfaceOrientations`. So `lockAsync(LANDSCAPE)` rotates
  even though Info.plist is portrait-only. (It defers to react-native-screens only
  when a screen explicitly sets a `screenOrientation` trait — expo-router screens
  don't, so the registry mask wins.)

The app's portrait baseline comes from the unchanged `app.json` (no startup lock
needed); the fullscreen hook re-locks `PORTRAIT_UP` on exit/unmount.

> An earlier draft flipped `app.json` to `"default"` + added a global startup lock
> and claimed a rebuild was required — both reverted as unnecessary once the
> AppDelegate-override path was confirmed. **Fallback only if device testing shows
> iOS not rotating** (e.g. an unforeseen RNScreens interaction): flip `app.json` to
> `"default"` (Info.plist permits landscape) + add the global `PORTRAIT_UP` startup
> lock back — *that* path would need one `eas build --profile development
> --platform all`.

### What was built

- **`src/hooks/useFullscreenVideo.ts`** (new) — `enter(landscape)` / `exit()` +
  `isFullscreen`. `enter(true)` → `lockAsync(LANDSCAPE)` (allows **both** landscape-
  left and landscape-right; the OS keeps the picture upright either way — satisfies
  "upright whichever way they turn"). `enter(false)` → portrait fullscreen (just
  drops the chrome). Hides the status bar while fullscreen; always re-locks
  `PORTRAIT_UP` on `exit()` and on unmount, so a screen can't leak a landscape lock.
- **`useMediasoup`** — new `setRemoteAudioVolume(0..1)` driving the consumed remote
  audio track's `_setVolume()` (react-native-webrtc's per-track gain; **no system-
  volume dep needed**). Used as a mute toggle (0 = muted, 1 = unity); unmuted by
  default (no behaviour change until the viewer mutes).
- **`StreamScreen` (WebRTC live viewer)** — a `maximize` button in the viewer action
  cluster opens a full-bleed overlay (own `RTCView`/visualizer of the same stream)
  with a `minimize` close button + a mute/unmute toggle. Enters landscape
  iff `videoIsLandscape` (already computed from the consumed track). Auto-exits
  fullscreen when the viewer leaves the room (stream end / tab blur / drop).
- **`ExternalStreamScreen` (expo-video HLS)** — same overlay (mute drives
  `player.muted`). Aspect is **detected per cam** from the loaded
  track (`sourceLoad` / `videoTrackChange` → `VideoTrack.size`), defaulting to
  landscape until the first dimensions arrive; fullscreen rotates only for
  landscape cams. Exits fullscreen on unfocus.

### Not yet tested on device

Needs an on-device pass after the rebuild: iOS landscape rotation + upright-both-ways,
the portrait-everywhere-else lock holding across navigation, volume/mute on the live
WebRTC track, and the overlay layout (close button clear of the notch in landscape).

---

## Updates — June 2026 (Clips grid: playhead-driven playback + buffer-window reaper UX)

Big pass on the Clips landing grid (`ClipsScreen` + `ClipsTimeline` + `ClipViewer` +
`TimeScrubber`), all on `design`, all pure JS (hot-reloadable, no native rebuild). Canonical
detail: **DESIGN.md decision log (2026-06-13)** + CONTENT.md §6. **⚠️ Checkpoint, not a close-out —
known bugs remain** (Ben is still squashing; flagged below).

- **Playback is playhead-driven** (CONTENT.md §6). One authoritative wall-clock playhead advances by
  real time (1× footage, 3s rush across a gap); the video + timeline follow. Replaced the old
  video-drives-playhead model — fixes the stalls / snap-backs / 1969-clock. `locateAt` resolves
  footage/gap/end; snips play unbroken (no reload on same-URL VOD); never reset by churn.
- **Seam flash fix** — `ClipViewer` poster is always-mounted + opacity-toggled, with a `coverPoster`
  flag holding the incoming frame over a between-lane VOD reload (no bg flash).
- **Clock** — `TimeScrubber` hold-mode freezes a held THEN instant (paused clock no longer bounces a
  second); new `liveTick` ticks a held THEN live for the reaper-edge case. NOW ↔ now-edge bound.
- **Buffer-window reaper UX** — grid windowed to `[now−windowHours, now]` (drops saved clips older
  than the window). Dark head/tail caps; leading reaper gap + "until oldest is reaped" countdown
  card; trailing gap rushable to now + "since last broadcast" count-up card; per-lane reaper edge
  (red **sickle** = buffer eaten, black **save** = saved scrolling out); **60fps** reaper mask
  consuming the oldest clip via `useFrameCallback` (no re-render, no layout drift); periodic 15s
  buffer refetch so footage shrinks with the backend reaper.
- **Still owed (known bugs + follow-ups):** on-device pass of the whole thing; the reaper scroll
  doesn't follow the advancing edge while idle (park-on-edge creeps off-centre); the not-reaping→
  reaping transition has a one-time GAP_W layout shift; playhead-clamp out of the reaped region is on
  the 10s tick. Seam discipline holds — these are Ben's `design` components/scaffold; Aaron owns the
  real buffer/manifest wiring (`screens`/`hooks`/`api`).

---

## Updates — June 2026 (Chat persists into the buffer — armed sources reach the recorder)

Item 2 of `HANDOFF-aaron-2026-06-13.md` ("chat persistence → wire to the chat
track"). The mediasoup buffer `.jsonl` chat sink + the durable `ChatMessage`
moderation store both already shipped (2026-06-12); the missing seam was **app-side**
— the recorder only records a data track for a kind in `room._meta.sources`, and the
app sent `createRoom` only the **AV** set (`camera`/`audio`), so chat (and location,
and any sensor) never recorded ("nothing writes to it yet").

**Fix (`StreamScreen.tsx` `handleGoLive`):** a new **`recordedSourcesFromConfig(cfg)`**
maps the armed `captureConfig` (the `air` keys cam→camera, audio→audio, loc→location,
screen, gyro, compass + the `chat:'on'` flag) to the backend's canonical kind names,
and `createRoom({ sources })` now sends that **full armed set** instead of `av`.
`startBroadcasting(av)` + `useBroadcastStore.setLive(av)` stay **AV-only** (getUserMedia
+ the live source rail are unchanged). Capture ⊆ broadcast — the armed data sources are
aired sources, so they belong in `Stream.sources`.

**Consequences (surfaced, not surprises):**
- **Chat now records** to the buffer `chat/<sessionId>/<chunkMs>.jsonl` track when
  chat is armed → the saved-clip chat track (`SourceChatLog` + `progress`) becomes real
  on save (the backend `promoteBufferClip` already promotes the `chat` data kind).
- **Location now records** too (it's armed by default and already airs via
  `locationUpdate`) — a natural down-payment on item 4 ("every source saves"). Gyro/
  compass would also record once armed, but the app doesn't emit them yet (item 3), so
  they'd just create empty track dirs — harmless.
- **Backend:** `VALID_SOURCES` in `internal.ts` had to widen from `['camera','audio']`
  to the full set or the `streamStarted` Zod enum would reject `chat`/`location` and
  break go-live. Paired change (see `wrld-backend/CLAUDE.md`).
- **Viewer source rail:** `Stream.sources` now carries the data kinds, so the viewer
  rail's `availableKinds` filters to **AV** (`camera`/`audio`) — the switchable
  chat/sensor source-views are the `SourceStage` telemetry work (item 3). No globe
  card change (no feature iterates `Stream.sources` into badges).

Pure JS, no native module — hot-reloads, no EAS rebuild. **Needs an on-device pass:**
go live with chat armed → send chat → confirm `buffers/<userId>/chat/<sessionId>/…jsonl`
fills, and a saved clip over that window carries the chat track. The mediasoup +
backend halves are already deployed; this app change + the `VALID_SOURCES` widen are
what light it up end-to-end.

---

## Updates — June 2026 (Sensor telemetry data path — visualizers light up)

Item 3 of `HANDOFF-aaron-2026-06-13.md` / Part 2 of the source-visualizers handoff:
the 7 sensor visualizers (shipped presentational on `design`) now react to real
broadcaster sensor data. **Transport: Option A** (relay over the signaling WS, like
`chatMessage`). **No new native module / no EAS rebuild** — `expo-sensors` is already
in the dev client (`useDeviceOrientation` uses DeviceMotion in prod).

**Decisions taken** (per the handoff's asks): Option A transport · `motion` derived
**viewer-side** from `accel` (one sensor on the wire) · `temp` UI-present-but-data-
absent (no reliable phone sensor) · `torch` is a control not a sensor (emitted on
toggle, not in the capture loop — deferred).

**Wire contract** (`src/lib/mediasoupSignaling.ts`): `TelemetryPayload` discriminated
by `kind` (compass/gyro/accel/speed/torch, each with `ts`). Broadcaster →
`{ type:'telemetry', payload }`; server fans out `{ type:'telemetryUpdate', payload }`.
`sendTelemetry` added to the client + `useSignaling`.

**Broadcaster capture** (`src/hooks/useTelemetryCapture.ts`): while live, reads the
armed sensor sources and emits — compass via `expo-location` `watchHeadingAsync`,
speed via `watchPositionAsync.coords.speed` (both already deps), gyro+accel via one
`expo-sensors` `DeviceMotion` listener (~15 Hz). All guarded — a missing sensor just
leaves that visualizer idle.

**Viewer consume** (`src/hooks/useStreamTelemetry.ts`): subscribes to `telemetryUpdate`,
keeps the latest sample per kind (drops stale `ts`), derives `motionIntensity` from
accel. Single decode point.

**StreamScreen render** — swapped the inline `cam ? RTCView : AudioVisualizer` switch
at all three media surfaces (broadcaster monitor · viewer · fullscreen) for the
**`SourceStage`** section (Ben's universal renderer), fed a `buildSource(kind, camSlot)`
`SourceRender` from `tel`/`audioLevel`/the injected RTCView. `activeSource` widened
`SourceType → FeedKind`; `availableKinds` now maps `Stream.sources` (which carries the
armed sensor kinds since item 2) → FeedKind via `SOURCE_TO_FEEDKIND`. The viewer's rail
shows the sensor sources and their visualizers animate from live data; the broadcaster's
rail stays AV (self-monitoring sensors is separate — the broadcaster doesn't receive its
own fan-out). `useTelemetryCapture(armedKinds, sendTelemetry, isLiveBroadcast)` wired.

**Recording (C6 down-payment):** mediasoup also appends each telemetry sample to the
buffer `.jsonl` track (when the kind is armed/recorded), so saved clips carry the
telemetry track. Pairs with the backend `ts`/`t` data-sample fix (without which ALL
data tracks — location, chat, telemetry — promoted empty; see `wrld-backend/CLAUDE.md`).

**Scope notes:** `loc` (trail), `chat` (source-view), `profile` source-views are
omitted from the rail for now — each needs its own data wiring (path accumulator /
chat-log mapping / host identity), separate follow-ups. `torch` emission on toggle is
TODO. Two DeviceMotion listeners (orientation + telemetry) coexist but share one
`setUpdateInterval` — an on-device tweak if the rate fights.

Pure JS — hot-reloads. **Needs an on-device pass:** broadcaster arms compass/gyro/
accel/speed → a viewer switches to each source and sees it animate from real motion;
confirm the saved-clip telemetry track fills.

---

## Updates — June 2026 (C6 — recorded data tracks play back in the clip editor)

Finishes item 4. The design renderers were already wired in `ClipEditScreen` (fed
`MOCK_*`); this feeds them **real recorded samples** at the playhead.

- **`src/hooks/useDataTrack.ts`** — fetch + parse a data track's NDJSON (`.jsonl`)
  into ts-sorted `DataSample[]` (the tokenized buffer `session.dataUrls[kind]` or a
  saved clip's `track.dataUrl`). Re-fetches on url change (source/session switch).
- **`src/lib/dataTrackRender.ts`** — pure mappers `samples → renderer inputs`:
  `toGraphValues` (compass=heading/360 · gyro=tilt-magnitude · speed · accel),
  `readingAt`, `toTrail`/`trailPositionAt` (location), `toChatLog` (chat).
- **`ClipEditScreen`** — fetches the viewed data source's track for the session
  under the playhead (`sessionAtPlayhead.dataUrls[view]`) and feeds
  `SourceLocationTrail` / `SourceTelemetryGraph` (compass·gyro) / `SourceChatLog`
  at `viewProgress`; falls back to the `MOCK_*` placeholders until samples land.
- **`src/api/buffer.ts`** — `BufferTrackKind` widened (+accel/speed/torch/chat);
  `BufferSession.dataUrls`.

Backend half: a tokenized `GET /buffer/stream/:sessionId/:kind/data.jsonl` route +
per-session `dataUrls` (see `wrld-backend/CLAUDE.md` "C6"). **Seam:** the renderers
are Ben's (`features/`, untouched — props were already real-data-shaped); this is the
data wiring (`hooks/`/`lib/`/`screens/`). Pure JS, no rebuild.

**On-device pass:** arm gyro/compass/location/chat → scrub the editor to that footage
→ switch the source rail → the visualizer animates from real motion (not the static
mock). **Edge (follow-up):** a fully-saved clip whose buffer evicted reads its data
from the clip API `track.dataUrl` (already exposed) rather than the buffer route.

---

## Updates — June 2026 (Content decision A — reversible location precision)

Item 5 of `wrld-app/HANDOFF-aaron-2026-06-13.md` / CONTENT.md §1.4·§7·§8 (decided
2026-06-13): location precision (and identity) are **reversible display-layer
choices** — blur OR sharpen, any time — not an immutable go-live ceiling. Capture
keeps full fidelity; replay/discovery read the clip's **current** choice.

**What was actually shipped vs. the handoff's premise:** the handoff said "drop the
≤-ceiling clamp" — but **there was no clamp in code.** The "immutable ceiling" was a
*documented intent* never enforced: `PATCH /buffer/me/clips/:id` already sets
`clipData.locDisplayPrecision = patch.locDisplayPrecision` with no bound (any of
exact/city/country/off), and capture always stored exact coords (`Stream.lat/lng`;
obfuscation is read-time only). So the rework is one real behaviour change:

- **`GET /clips/discover`** now reads **`COALESCE(c."locDisplayPrecision",
  s."locationPrecision", 'exact')`** for both the display coords and the `off`
  exclusion (was `s."locationPrecision"`). The globe/time-machine now honour the
  clip's *current* precision; `off` excludes only while currently off (re-enabling
  brings it back). Live streams still use the stream's go-live precision (correct —
  live has no clip yet). Doc comment in `docs/design/c4-clip-manifest-editing.md`
  updated (was "≤ captured ceiling").

**Not done — and NOT a "remove the bound" task (the handoff mis-scoped it):**
- **A clip-editor UI to edit precision/identity.** The app `patchClip` API + the
  `LocationGranularityPicker` are already unbounded, but no control in `ClipEditScreen`
  drives `locDisplayPrecision`/`attributed` (only `visibility` is patched on save).
  Exposing it is **net-new UI** (compose the picker + an identity toggle → `patchClip`).
- **Identity on discover + buffer-clip discover (C4.5).** `clips/discover` joins
  `Clip→Recording→Stream`, so it surfaces only recording-sourced clips (all purged) —
  buffer-promoted clips aren't on the globe at all yet, and the query returns `host`
  unconditionally (doesn't honour an anon clip's `attributed`/`visibility`). Surfacing
  buffer clips with visibility + the clip's current precision/identity is the tracked
  **C4.5** discover-completeness work — larger than item 5's reversibility rework.

---

## Updates — June 2026 (Decision A app prep + front-end handoff to Ben)

Reversible location precision/identity (CONTENT.md §1.4/§7/§8) is implemented on the
backend (capture keeps full fidelity, no ≤-ceiling ever existed, `clips/discover` reads
the clip's *current* precision + honours anon identity — see `wrld-backend/CLAUDE.md`
"Content decision A" + "C4.5"). App side:

- **`ClipEditScreen.saveClip(name, privacy?)`** now accepts + persists
  `{ locDisplayPrecision, attributed }` via `patchClip` (omitted = leave the clip's
  current value — a new draft inherits the go-live precision server-side, so this never
  clobbers). The data seam is ready; the **edit control is Ben's lane**.
- **Front-end work still needed is collected in `HANDOFF-ben-frontend-2026-06-13.md`:**
  (1) precision picker + Public/Anon identity segment in `SaveClipSheet` (decision A),
  (2) a reusable Public/Anon `SegmentedToggle`, (3) a `DiscoveryHandoffCard` `kind:'clip'`
  variant for the time-machine globe (Watch CTA + anonymous-host rendering — gated on the
  app clip-pin consumer, still unbuilt). Everything else from items 1–5 (visualizers,
  `SourceStage`, scissor/snip, C6 renderers) is already Ben's and shipped.

---

## Updates — June 2026 (Content decision B — the Report Centre / moderation hold)

Item 6 of `HANDOFF-aaron-2026-06-13.md`, fully specified (Ben + decision, 2026-06-13).
Canonical principle: **CONTENT.md §3** ("A third, platform-side hold — the Report
Centre"). This is the **third pool** alongside the rolling buffer + saved-clip pool:
reported content is copied to a platform-owned hold that survives the creator's
deletion. Backend/mediasoup work; **the review/takedown UI is v0.3** — the
copy-on-report retention is what's decided now.

### Decided shape
- **Reportable:** a **live stream** *or* a **public clip** (clips are public — time
  machine + profiles). Both produce a Report Centre record.
- **Copy unit:**
  - **Live stream →** `[T − 60s, T + 30s]` around the report instant T —
    retrospective-weighted (the infraction precedes the tap). Tail copied shortly
    after T from the still-writing buffer (no race; buffer holds ≥24h). Head clamps
    to session start if the session is < 60s old.
  - **Clip →** the **whole clip** (already bounded — no window).
- **All sources** copied (camera/audio/screen + location/chat/sensors) at **capture
  fidelity** — reuses the `promoteBufferClip` copy-out mechanism, but into a
  platform-owned pool (`moderation/<recordId>/` or similar), not the user's saved pool.
- **Full fidelity / no hiding:** stamp the **real `hostId` + exact coords** on the
  record regardless of the content's current `attributed` / `locDisplayPrecision`
  (the platform always retained both — CONTENT.md §1.4). Reads *through* the
  reversible display layer.
- **Readership:** moderators only. Never tokenized to the creator; owner has no read
  path.
- **Retention/authority:** held until a moderator acts; **only moderators delete**.
  No reaper, no TTL. **Must not cascade** — un-save / delete-clip / account-delete
  cannot wipe it. Past the buffer window it's **outside the creator's quota**.

### Concrete model (SETTLED 2026-06-13 — no FK into the deletable graph)

The source is named by **denormalized scalar columns**, never a Prisma `@relation`,
so no `onDelete` path can reach the evidence. The only cascade is internal (the
record → its own held ranges). Decided shape (Aaron tunes names/types; the *no-FK*
rule is fixed):

```prisma
model ReportEvidence {              // one row per reported piece of content
  id          String   @id @default(cuid())
  targetType  String                 // 'stream' | 'clip'
  targetId    String                 // streamId or clipId — SCALAR, no @relation
  hostUserId  String                 // real owner, captured — SCALAR, no @relation
  hostHandle  String                 // captured at copy time (survives user deletion)
  capturedLat Float                  // exact coords, through the display layer
  capturedLng Float
  storagePath String                 // platform-owned moderation dir (NOT the saved pool)
  sizeBytes   BigInt   @default(0)
  status      String   @default("held")   // 'held' | 'resolved' (moderator-set)
  createdAt   DateTime @default(now())
  ranges      ReportEvidenceRange[]  // internal children — cascade from here is fine
  reports     Report[]               // the N reports that cite this content
  @@index([targetType, targetId])    // accretion lookup: does a record already exist?
}

model ReportEvidenceRange {          // the held wall-clock spans (accreted, merged)
  id         String @id @default(cuid())
  evidenceId String
  evidence   ReportEvidence @relation(fields: [evidenceId], references: [id], onDelete: Cascade)
  startAtMs  BigInt
  endAtMs    BigInt
  ordinal    Int
}
```

`Report` (Phase 5/22) gains a nullable `evidenceId String?` + relation with
**`onDelete: SetNull`** (deleting a report never touches the evidence; many reports →
one `ReportEvidence`). **No** column on `Clip`/`User`/`Stream` points *at*
`ReportEvidence` — the reference is one-way and scalar. Accretion: on report, look up
`(targetType, targetId)`; reuse the existing record if present, else create one; merge
the new `[T−60s, T+30s]` window into `ranges` (overlap → extend; disjoint → new range);
attach the `Report`.
- **Many reports → one content record:** a second report on the same infraction
  attaches to the **existing** record (no re-copy). Overlapping `[T−60s, T+30s]`
  window → copy only the **additional head/tail** to extend the held span; disjoint
  windows add another range to the same record. One content record, N reports.

### Lane split (Aaron — `wrld-backend` + `wrld-mediasoup`)
- Extends the existing report flow (Phase 5/22: `Report` row + the base64 `snapshotUrl`
  reporter screenshot). Today there's **no copy of the actual footage** on report —
  that's the gap this closes.
- **Backend:** standalone `ReportEvidence` model (no cascade) + the copy-out job
  (window resolve → `promoteBufferClip`-style copy into the moderation pool); attach
  N `Report` rows; accretion/overlap-merge logic; quota exclusion. The **clip-report**
  path copies the whole clip; the **live-report** path resolves `[T−60s, T+30s]` from
  the buffer.
- **mediasoup:** no new capture work — the buffer already holds the window; the copy
  is backend-side out of the persistent buffer. (Confirm the tail grab for a live
  report fires after `T + 30s`.)
- **App (later, Ben's lane):** no v0.2 surface beyond the existing report buttons —
  the moderator review UI is v0.3. The report-submit flow (`streamsApi.report` +
  snapshot) is unchanged; a clip-report entry point on the clip/profile surfaces is
  net-new front-end when we get there.

---

## Source-parity rollout (camera-parity for every source) — June 2026

> **Principle: CONTENT.md §1 principle 7 + §6 "Every source is a live surface, on every
> frame" + §9 "A live tap for every armed source."** The camera is not privileged — it's the
> *default* source. Every source must get the SAME treatment at every stage: a live
> self-preview for the broadcaster (broadcasting or not), live consumption by viewers, a write
> to the server buffer, saveability into clips, a switchable preview on **every** viewer frame
> (stream page · clips page · someone else's stream), and a now-edge that shows the **live**
> source feed the way the camera does. This rollout drives the build to that bar; honest
> degradation (idle, never faked) holds wherever a stage isn't wired yet.

This supersedes nothing — it's the umbrella the source-visualizers initiative (telemetry data
path) and the clip-view switching feed into. The wire contracts (telemetry/chat relay,
`SourceStage`, `ClipSourceView`, `useLocalTelemetry`) already exist; this tracks closing the
gaps to full parity.

**What we need from Aaron is tracked in `HANDOFF-source-parity-aaron-2026-06-16.md`** (SP5 live
location relay · SP6 persist/save audit + screen). The SP2/SP3(non-loc)/SP4 stages are Ben/`design`.

### Stages (SP0–SP6)

| Stage | Owner | Branch / repo | What | Status / depends on |
|---|---|---|---|---|
| **SP0** | Ben | `design` | **Principle + contracts.** CONTENT.md §1.7 / §6 / §9 written; the relay + render contracts (`telemetry`/`telemetryUpdate`, chat relay, `SourceStage`/`ClipSourceView`, `SourceRender`) defined. | ✅ done 2026-06-16 |
| **SP1a** | Ben | `design` | **Stream view: full always-present left rail** (AV + 7 sensors), every state (preview · live broadcaster · viewer). Broadcaster self-previews its own sensors **locally** (`useLocalTelemetry`, preview+live); viewer reads the fan-out (`useStreamTelemetry`). | ✅ done 2026-06-16 |
| **SP1b** | Ben | `design` | **Clip view: source switching** over recorded tracks (`ClipSourceView` section + `ClipViewer.rail`/`sourceSlot`; `useDataTrack` at the playhead). | ✅ done 2026-06-16 |
| **SP2** | Ben | `design` | **Preview parity.** Audio is now **metered in PREVIEW too**, not just live (2026-06-17): `useMediasoup.startPreviewMeter` spins a throwaway local `RTCPeerConnection` holding the mic track so `getStats().media-source.audioLevel` reports before go-live (no server, no new dep) — torn down on go-live (the producer poll takes over), on a source change, and in cleanup. **Ambient temp REMOVED 2026-06-17** (deprecated — no instrument on real phones; dropped from the dashboard + rail; Aaron to drop from `VALID_SOURCES`). **Accelerometer is one source keyed `accel`** (3-axis xyz readout; `motion` is the same instrument's derived view, not a separate button). `screen` not in the rail (no capture). | ✅ done 2026-06-17 (audio live in preview + live + viewer) |
| **SP3** | Ben | `design` | **Stream rail: chat · profile as live views** (`chat` → `SourceChatLog`; `profile` → `SourceIdentityCard`), ordered by the shared `SOURCE_RAIL_ORDER`, horizontal + scrollable. **The rail shows ARMED/CAPTURED sources only** (Ben 2026-06-17, supersedes the brief "full suite + idle" model): identity always; broadcaster = `captureConfig.air` (+chat); viewer = `Stream.sources`; clip = the clip's captured `kinds` (so the clip rail varies per clip). `KIND_TO_FEEDKIND` maps the backend names. A data-only / location-only stream is valid (identity + location). | ✅ done 2026-06-17 |
| **SP4** | Ben | `design` | **Now-edge live feed for ALL sources on the clips page.** Riding the now edge shows the live SELECTED source: camera (RTC), **audio** (`broadcastStore.liveAudioLevel`, published by `StreamScreen`), **sensors** (`useLocalTelemetry` read locally on `ClipsScreen`) — via `SourceStage`; past → recorded `ClipSourceView`. `loc`/`chat` live taps not here yet → recorded fallback. | ✅ done 2026-06-16 (cam/audio/sensors; loc on SP5, chat-live later) |
| **SP5** | Aaron | mediasoup + backend | **Live location relay** (the one substrate gap) — mediasoup relays `location` like telemetry; viewer accumulates a trail; broadcaster self-trail local. Unblocks loc in SP3/SP4. | ✅ **data side done 2026-06-17** — mediasoup fans `locationUpdate` → `telemetryUpdate{kind:location}` to viewers (option **b**: off the existing `locationUpdate`, no double-record); `TelemetryPayload`+`useStreamTelemetry` decode `location`; `useLocalTelemetry` self-samples it. **Trail render (accumulate `[lng,lat][]` → `SourceLocationTrail`) is Ben's** — and Ben must NOT also emit `location` from `useTelemetryCapture` (would double-fan + double-record). ✅ **render done (Ben, 2026-06-17)** — new `useLocationTrail` accumulates `monitorTel.location`/`liveTel.location`; `loc` renders a live trail on the stream rail + the clips now-edge (recorded loc already worked); no new emit (consume only). |
| **SP6** | Ben + Aaron | both | **Persist/save parity audit + screen source.** Confirm every armed source writes a track AND promotes into a saved clip (sensors/chat/location ✓ via item 2 + C6; audit torch on-toggle emit/record). **Screen** source end-to-end (capture/produce + live view + record) is the largest remaining gap — likely its own slice. | **SP6a DONE 2026-06-17.** Backend items all built+deployed (data-only go-lives now record + get wall-clock `durationSec` · `temp`/`motion` dropped from `VALID_SOURCES` · `audiolevel` companion track) — see `HANDOFF-source-parity-aaron-2026-06-16.md` "OPEN ITEMS". On-device verify owed for the data-only path; **Ben follow-up:** `AudioVisualizer` history-mode reads the `audiolevel` `dataUrl` (companion of audio, not a rail item). **torch toggle (signaled channel) ✅ done (Ben, 2026-06-17)** — `TorchVisualizer.onToggle`; broadcaster holds `torchOn` + emits `sendTelemetry({kind:'torch',on})` (viewers light up, recorded when armed). **SP6b — v0.3 native-capture slice (DEFERRED, decided 2026-06-17):** the **real device torch (LED)** AND **screen share** are built together — both need native capture work RN-WebRTC doesn't expose (a module reaching into / coexisting with the WebRTC `AVCaptureDevice`, careful not to reset the pinned capture resolution) + an EAS rebuild. The torch stays the signaled channel until then; the lamp UI + record path are already done, so the spike only swaps in the physical LED. Ambient temp **deprecated/removed** (no instrument). |

> **SP6a torch findings (2026-06-17).** The torch **substrate is fully ready**: `TelemetryPayload`
> already has `{kind:'torch',on,level?}`; mediasoup `DATA_KINDS` includes `torch` and the
> kind-agnostic `telemetry` handler records it when armed; `bufferClipService` promotes it
> generically (non-media kind → copy `.jsonl`). The recorder records **`armed ∩ DATA_KINDS`**,
> and `DATA_KINDS` = the full data-source set (location/gyro/compass/chat/accel/speed/torch;
> temp has no sensor) — so no hardcoded-subset gap. **What's missing is a CONTROL:** nothing
> emits `{kind:'torch',on}`. It needs an interactive toggle on the broadcaster's `SourceStage`/
> `TorchVisualizer` (Ben's `sections/`+`features/` lane) → on toggle: `signalingClient.sendTelemetry({kind:'torch',ts,on})`
> + drive `buildSource('torch')` off a local `torchOn` state (the broadcaster's `monitorTel.torch`
> is never set — torch isn't a sensor). **Real device flashlight is OUT for now:** react-native-webrtc
> 124 has no torch API, and `applyConstraints` would reset the pinned capture resolution — so the
> torch source is a **signaled on/off channel** (morse/state), not the physical LED. The LED is a
> separate device-specific spike (likely a native module that contends with WebRTC's camera).
> **SP6b screen: deferred to v0.3** (mark the `screen` rail view honest-idle).

> **Backend items ✅ ALL DONE (Aaron, 2026-06-17)** — data-only recording + wall-clock `durationSec`
> (✅ data-only persistence on-device verified), `temp`/`motion` dropped from `VALID_SOURCES`, the
> `audiolevel` companion track now exposed in `session.dataUrls.audiolevel` (`wrld-backend` `b3258c5`
> — was the one missing key). App side done: clip rail derives from `kinds`∪`dataUrls` (chat/audio/
> location confirmed on-device), and `AudioVisualizer` history-mode reads the `audiolevel` window.
> **Remaining: deploy `wrld-backend` to the box + on-device verify the audio waveform replays.**
> Detail: `HANDOFF-source-parity-aaron-2026-06-16.md` "OPEN ITEMS".

### Seam (unchanged)
Ben owns `primitives/`/`features/`/`sections/` + DESIGN.md + CONTENT.md §6 (the rail, the
visualizers, `SourceStage`/`ClipSourceView`, the always-present rail wiring he's crossed into
`screens/` for at his direction). Aaron owns the relays/recorder/backend (§9) + the real
data wiring in `screens/`/`hooks/`/`api/` (the live-location relay, the now-edge live taps on
the clips page, screen capture). Integration via `design` → `main` merges.

### Done-bar
Open any source on any frame and it shows that source live in the moment the way the camera
does; arm any source and a viewer can consume it, it writes to the server, and it saves into a
clip; riding the now edge on the clips page shows the live source feed. Where a path genuinely
can't be live (e.g. audio in preview, temp), it reads as an honest idle, never faked.

---

## Updates — June 2026 (Source-parity app pass: clip replay · armed rails · viewer/preview)

A run of source-parity refinements on `design`, all pure JS (hot-reload, no native module), merged to
`main` continuously. The cross-repo open items are the backend ones above (data-only recording, temp
drop, audio amplitude) — everything below is app-side and done.

- **Clip-source replay through the live visualizers.** Recorded clip sources replay via the SAME
  `SourceStage` visualizers as live (circle compass, gyro horizon, accel xyz traces, speed dial,
  torch lamp, location trail, chat log), **sampled at the playhead** (time-accurate by each sample's
  wall-clock `ts` — new `sampleAt`/`trailUpTo`/`chatUpTo`/`recentUpTo`/`torchStateAt` in
  `dataTrackRender`). Accel + the audio waveform get a **playback `history` mode** (scroll + rewind
  with the playhead, not an internal ticker). Location **holds the earliest fix** at the head; torch
  carries the **prior** state (inverse of the first toggle) to the head; chat **unfolds** + defaults
  empty (mock only when omitted). audio replay still wants the backend amplitude track.
- **Armed/captured-only rails** (supersedes the brief "full suite + idle"). The rail shows only
  sources actually there — broadcaster = `captureConfig.air` (+chat), viewer = `Stream.sources`,
  clip = the played session's `kinds` (varies per clip); identity always. `KIND_TO_FEEDKIND` maps
  backend names. Rail ICON order = dashboard order; the DEFAULT view is a separate importance order
  (`pickDefaultView`: camera · audio · sensors · speed · torch · location · identity).
- **Camera-off preview no longer blanks** — a broadcaster arming/preview state renders the selected
  source + rail (id/location/sensor) before go-live, with local sensor reads enabled in preview.
- **Clips page defaults to riding the now edge** on open; **data-only sessions keep their wall-clock
  length** so a camera-less clip persists in the timeline (given the backend returns the session).
- **Viewer UX:** retired the tap-up roomInfo overlay; tip · follow (compact) · report · fullscreen ·
  leave live in the always-visible top cluster; the profile source shows the same identity card as
  the broadcaster. **Audio preview metering** via a throwaway local loopback PC (device-confirmed).

---

## Reporting & moderation initiative — app-side status (2026-06-13)

> **The canonical status + resume checklist lives in `wrld-backend/CLAUDE.md`
> "Reporting & moderation initiative — STATUS / where we left off".** This is the
> app slice. The initiative is **partially built and not testable end-to-end** — a
> report can be filed + the footage held, but there's no in-product review surface.

- **Stream report submit — ✅** the ⚑ flag button in `StreamScreen` (Phase 5/22) →
  `streamsApi.report` + the base64 snapshot upload. Unchanged.
- **Clip report submit — 🔶 clip viewer ✅, profile cards ☐.** `clipsApi.report(id, reason)`
  → `POST /clips/:id/report` + a ⚑ flag in `ClipViewerScreen`'s top chrome → the same
  `ActionSheet` reason picker as the live-stream flag (auth-gated; no snapshot — the Report
  Centre copies the clip itself). Built 2026-06-24. **Still TODO:** a ⚑ entry on the
  **profile clip cards** (the other surface named in the original gap).
- **Moderation hold (Report Centre) — invisible by design.** On report, the backend
  copies the footage to a platform hold; nothing surfaces in the app (correct — the
  creator must never see it). So **there's nothing for Ben to test in-app** beyond the
  report buttons themselves; the hold is verified backend-side (DB row +
  `/opt/wrld-media/moderation/<id>/`), and the review loop needs the v0.3 moderator
  tooling (admin read/serve routes + the `wrld-admin` UI), which isn't built.
- **Next app work when the initiative resumes:** the clip-report ⚑ button. Everything
  else (moderator review/takedown) is `wrld-admin` + backend, not `wrld-app`.

---

## Updates — June 2026 (Clips timeline: single-clock model — smooth build + smooth reap)

Reworked the Clips-grid timeline (`ClipsScreen` + `ClipsTimeline`) around ONE principle (now stated
in CONTENT.md §6): **a single continuous monotonic clock is "now," and every position is
`timeToX(instant)` off it — the same shape that already makes scroll/play/drag smooth, finally applied
to the two reaper/now edges and the live build.** This resolves a long bounce/stall saga whose root
was *three* clocks (server clip geometry · device `nowMs` · the animation-frame clock) reconciling at
different rates — every bounce was a seam between them.

What landed (all `design`, pure JS — hot-reload, no native rebuild):
- **One smooth `nowUI` clock** (the UI-thread frame clock) drives the reaper edge AND the now edge.
  It is **monotonic** — the wall-clock re-anchor may pull it *forward* (catch-up after backgrounding)
  but never *backward* (the backward drift-snap was the per-tick bounce; clamped out).
- **Smooth realtime live build.** The open session's segment (`endedAt == null`, passed as
  `liveSessionId`) is **extended to `nowUI` per-frame** (`extendLive` in `ClipsTimeline`) instead of
  stepping on the 15s `mediaDurationSec` refetch. So the live clip + the now edge grow continuously,
  riding the *same* clock as the reaper edge — both edges, one clock. No trailing gap while live.
- **Reaper edge never passes centre + pulls the now edge in** via a sticky `riding` lock (`scroll`
  tracks the edge exactly while parked at it); the visual derives from `reaperEdgeXSv` (not the
  separately-written `scroll`), so a clip-drop can't desync the picture (no `scroll`/decay lag flash).
- **Leading gap kept, never removed.** A fixed `GAP_W` marker before the oldest clip; the reaper MASK
  sweeps across it (rushing the final ~3s) rather than the gap being deleted (its deletion was a 22px
  layout snap). Reads as a light "room" band, then reaped void — no pop.
- **Time-anchored view** (`scroll = timeToX(P)`, re-pinned on every clip-set change) so reaper drops /
  refetches never slide footage under the centre playhead.
- **Clip geometry is server-derived** (confirmed): a clip's start/length come from `startedAt` +
  `mediaStartOffsetMs` + `mediaDurationSec` — never front-end `now − start` math. `nowUI` is currently
  **device-clock** (`Date.now()`), which matches the already-smooth playhead.

> **Server-clock alignment — ✅ DONE 2026-06-13 (`HANDOFF-clips-server-clock-2026-06-13.md`).**
> Aaron shipped `serverNowMs` on `GET /buffer/me`; the app wired the slew in `ClipsScreen`:
> `serverOffset = eased(serverNowMs − Date.now())` per fetch → `nowMs = Date.now() + serverOffset`,
> so `nowUI` (and both edges + the live build) runs in the **server clock domain** the clip geometry
> is anchored to — device↔server skew removed. Falls back to the device clock when the field is
> absent. The live end is derived from the monotonic `startedAt + mediaStartOffsetMs +
> mediaDurationSec` (a head roll-off shrinks `mediaDurationSec` but `mediaStartOffsetMs` rises by the
> same Δ, so the end edge is invariant — confirmed with Aaron). The `live`/`riding` TimeScrubber
> clock readout still uses device `Date.now()` (skew cancels for held instants; sub-second cosmetic
> offset on the live readout only — the timeline geometry is fully server-aligned).

**`[reaper-trace]` dev logging is still in** (all `__DEV__`-gated, stripped in prod) for Ben's
on-device verification from `main`; strip in a one-line follow-up once confirmed smooth. **Needs an
on-device pass** — the live build growing smoothly while broadcasting, and the reaper edge consuming
without per-tick dip or clip-drop flash (single- and multi-session buffers).

---

## Clips timeline — north star vs current gaps (2026-06-13, on-device)

The definitive target is **CONTENT.md §6 "The Clips-timeline north star"** (now **6** invariants).
**✅ ALL SIX CONFIRMED SMOOTH ON DEVICE (2026-06-14)** — Ben: "definitely smoother on all fronts."

| # | North-star invariant | Status / what shipped |
|---|---|---|
| 1 | Going live → Clips shows a clip **building on the now edge in real time**, no fetch wait. | **✅ Fixed.** Was a ~10 s appear delay (the optimistic clip was dropped the instant `realLiveSessionId` arrived (~2 s), but the real HLS footage hadn't flushed yet → "No clips yet" until ~7 s). Now **ONE persistent live block** (`ClipsScreen.liveClip`) spans `[liveSince → now]` the whole time we're live, present from go-live; it adopts the real session's manifest/poster + `sourceSessionId` once that session exists (the real session is excluded from the normal carve so it isn't drawn twice). `liveSince` stamped at go-live in `broadcastStore`. Confirmed `liveClip/hasAny true` from ~3 s straight through the handoff. |
| 2 | Stop → a **trailing gap forms** and grows ("since last broadcast"). | **✅** Live tail keyed off the **newest open session** (was a stale ghost session). On stop, `liveSessionId` → null → `trailingGap` forms; `isLive`/`liveSince` cleared in the store. |
| 3 | Play · drag · resume stays smooth. | ✅ **Smooth** — keep, don't regress. |
| 4 | now edge → clock **NOW + ticking**; reaper edge → **THEN + ticking** toward eviction. | **✅** `getCenter` returns `atNow`/`atReaper`; `ClipsScreen` drives `followLive`/`ridingReaper` from them in scrub-follow / `onScrubEnd` / `goTo` / `goNow` / `goReaper`. NOW pins clock offset to 0 (ticks); reaper THEN ticks via `TimeScrubber liveTick`. |
| 5 | Reaper consumes **smoothly while dragging and while playing** — no jumps. | **✅** Latch/pin suspended during pan/play (`panningSv`/`playingSv`); monotonic `reaperNowSv` (forward-only clamp); rush-aware `reaperEdgeX`. |
| 6 | **Reaping + playing + broadcasting locked in sync** (no ~1 s cadence anywhere). | **✅ Fixed — root cause was a stalled clock, not the throttle.** The reanimated `useFrameCallback` clock (`frame.timeSinceFirstFrame`) **freezes during video playback** (heavy main-thread work starves the UI-thread frame timer) — it advanced ~3 frames then stalled ~10 frames then jumped a full second, so the live build/now/reaper edges stepped 1 s at a time. **Fix:** drive the continuous clock from a JS `requestAnimationFrame` loop in `ClipsScreen` (always-on while focused) that feeds the timeline a server-aligned now via `ClipsTimelineHandle.setNowUi()` every frame — the same JS clock that drives scroll smoothly. The timeline takes the **monotonic max** of the JS clock and its own frame clock (JS wins during playback; frame callback wins if the RAF isn't running). The earlier `commitPlayhead` ~12 Hz throttle stays (keeps JS-state churn down) but wasn't the cause. |

**Playhead keeps pace with the fronts (done 2026-06-14):** a follow-on to #6 — during broadcast +
reap + play the now/reaper fronts were overtaking (and the reaper passing) the playhead. The
`[clip-sync]` probe showed the playhead advancing ~55% of real time with negligible clamp loss → it
was being **rewound**, not throttled. Cause: `playheadRef.current = playheadMs` ran on EVERY render, so
any re-render between the ~12 Hz `commitPlayhead` snapshots (the commit itself, the 1 s `nowMs` tick, a
5 s buffer refetch) reset the ref to the last committed value and discarded the 60 fps frames advanced
since. Fix: while playing the tick OWNS `playheadRef` — `if (!playingRef.current) playheadRef.current =
playheadMs` (every non-tick setter sets the ref explicitly anyway). Confirmed: `gap = nowUi − playhead`
now holds flat (~3.1 s) at 1× play instead of climbing.

**Server-clock alignment (done):** `GET /buffer/me` returns `serverNowMs`; `ClipsScreen` eases
`serverOffset = serverNowMs − Date.now()` and runs `nowMs = Date.now() + serverOffset`, so the
reaper/now edges align with the server-clock-anchored clip geometry (no device skew).

**Universal wall clock (done 2026-06-15):** the whole saga's foundation — `src/lib/serverClock.ts`
(`serverNow()` / `feedServerNow()`), the ONE server-aligned clock every surface reads (CONTENT.md §6
"The universal wall clock"). Everything that represents a time position reads it (never accumulates a
frame-timer, never reads raw `Date.now()`): the now/reaper edges (`setNowUi`), the playhead (advances by
the wall-clock delta — telescopes to a clock read, drift-free), the clock readouts + card countdowns,
`TimeScrubber` (globe + editor), `ClipEditScreen`, `useBroadcasterClock`. The `ClipsTimeline`
frame-timer accumulator was retired (sole driver = `setNowUi`).

**Edge behaviour (done 2026-06-15):** drag clamps at the reaper edge (can't enter the void) and the now
edge; the playhead **sticks** to the now edge (`followNow` pin) the way it rides the reaper; the clip
geometry **shrinks from the left** at the reaper (each clip's left clamps to `reaperEdgeX` → its own
rounded-left corner, no hard mask crop); play-after-drag no longer misfires (the orphaned scrub gate is
cleared on play/seek/nav); **riding = playing** with a distinct **slashed-pause** for the
can't-pause reaper ride; and `ridingReaper` is a continuous **mirror** of the timeline's `ridingSv`
(`onRidingChange`) — plus `suppressRide` lets the clock-wheel move forward off the reaper edge.

**Probes stripped (2026-06-15):** all `[reaper-trace]` / `[clip-sync]` / `[clips-save]` / `[play]` /
`[pic]` `__DEV__` logs + their diagnostic-only shared values are removed. **The Clips-timeline clock
saga is complete.** Backend follow-up still open (Aaron): reap/close ghost sessions (0-duration, no
`endedAt`) so they never masquerade as the live tail.

**⛳ MILESTONE — `clips-timeline-clock-v1` (2026-06-15).** This state is the **definitive reference
baseline** for content-timeline handling — tagged in git, principle-captured in **CONTENT.md §6
"⛳ Milestone — the Clips-timeline clock is solved"**. Closes the freeze bug (a cancelled pan fired
only `onFinalize`, not `onEnd`, so `notifyScrubEnd` was skipped and `scrubbingRef` stuck true →
"stopped playing but pause icon showing"; fixed with an `onFinalize` backstop in
`ClipsTimeline`'s pan gesture). The one acknowledged residual is a *very* subtle ~120fps clock-pacing
shimmer while the playhead advances (the `setNowUi` RAF feeds the clock at ~60fps; the panel refreshes
at 120fps) — **principled, not a hack** (the picture is correctly *derived* from the universal clock;
only the clock's feed rate is sub-display) and **inert for clip editing** (editing reads held instants —
brackets, trims, scrubbed positions — never the live-advancing clock). Future work **springboards from
this tag and may only improve it.** Spine to re-read on resume: `src/lib/serverClock.ts`,
`ClipsScreen.tsx` (transport + `setNowUi`), `ClipsTimeline.tsx` (`effScrollSv` + magnetic frontiers +
gesture backstop).

---

## Updates — June 2026 (P4 — globe on the viewport tile-subscription protocol)

P4 of the globe-discovery scaling plan (`wrld-backend/docs/design/globe-discovery-scaling.md`).
The live globe now speaks the **viewport tile-subscription protocol** (P2, already
deployed backend-side + on the web) instead of pulling the global snapshot. **Backend
unchanged** — the app just connects with `?viewport=1`. Doubles as the structural fix
for the globe re-render jank (per-event re-renders are now coalesced to one/frame).

### New files (mirror the web)
- **`src/lib/tiles.ts`** — slippy `z/x/y` math, **byte-identical** to
  `wrld-backend/src/lib/tiles.ts` + `wrld-web/src/lib/tiles.ts`. Keep in sync.
- **`src/hooks/useViewportDiscovery.ts`** — RN port of the web hook. Connects
  `…/streams/discovery?viewport=1`; returns `{ pins, counts, mode, setView }`; holds
  pins/counts in refs; coalesces state flushes to one `requestAnimationFrame`;
  legacy-`snapshot` fallback (Redis off → all live streams as pins). Knobs
  (`PIN_ZOOM_THRESHOLD`/`COUNT_MIN_ZOOM`) via opts (fallback = tiles.ts), in a ref so
  the long-lived subscribe closure reads current values.

### `GlobeScreenMapbox` integration
- **Map pins** come from `useViewportDiscovery` (named `streams`, so the geoJSON /
  pin-tap / card-sync code is unchanged). **Count bubbles** (low zoom) render from a
  new `tile-counts` `ShapeSource` (red circle + abbreviated-count label); tapping one
  drills in (`cameraRef.setCamera` zoom+3). Pins source + counts source are mutually
  exclusive by zoom (the hook only populates one regime), so they never overlap.
  Self-pin (black), subscription colours, precision halos, clustering — all unchanged.
- **Drawer "Nearby now" / search / LIVE pill** now read **`useStreamsNear(lat, lng, 20000)`**
  (bounded REST — server caps at 100 nearest) instead of the global feed. Decision
  (Aaron, June 2026): the viewport feed only knows on-screen pins (nothing individual at
  low zoom), so the list surfaces use `near`. The generous radius keeps the drawer
  populated at today's sparse global scale and tightens to genuinely-nearby as density
  grows; falls back to `(20,0)` before a GPS fix so it's not empty for location-denied users.
- **`setView` wiring:** a throttled `pushViewport()` (≥400ms; the hook also debounces +
  skips unchanged tile sets) calls `mapViewRef.getVisibleBounds()` → `setView`, fired
  from `onCameraChanged` (so auto-rotation + pans re-subscribe) + on map load + when the
  config knobs change. Admin knob edits apply on app relaunch (+30s server config cache).
- **Config:** reads `PIN_ZOOM_THRESHOLD` / `COUNT_MIN_ZOOM` from `usePublicConfig`
  (admin-tunable RemoteConfig; "Globe discovery" section in the admin panel).

### Known semantic shifts (intended, per P2 design)
- **LIVE pill = nearby count** (up to 100 nearest), not a global total. A global count
  would need a dedicated cheap endpoint.
- **Open stream card's viewer count is static at tap time** — `viewer_count_updated` is
  intentionally dropped from the globe feed under viewport mode (counts belong to the
  stream, fetched on tap). The card still shows the count from pin-load.
- **Drawer refreshes every ~60s** (the `near` query interval) rather than live-via-WS.

### Status / not device-tested
`tsc --noEmit` clean; no new native module (no EAS rebuild). **Needs an on-device pass**
(Android priority): count bubbles at the default low-zoom globe, drill-in on bubble tap,
individual pins when zoomed past `PIN_ZOOM_THRESHOLD`, smooth re-subscribe on
pan/rotate, the "Nearby now" drawer populating from `near`, and that rotation no longer
stutters as cams stream in the background. The time-machine seam is unchanged (historical
clips still Aaron's unbuilt backend; the live feed is now viewport). **P5** = retire the
legacy global-snapshot path once both clients have soaked on viewport.

---

## Updates — June 2026 (Clips page: live-while-broadcasting playback + the dead-zone quandary)

A run of Clips-page (`ClipsScreen` + `ClipsTimeline` + `ClipBlock`) refinements on `design`,
all pure JS (hot-reload, no native rebuild), merged to `main` continuously. Then the big
open item — the **live-replay dead zone** — was captured in CONTENT.md for Aaron.

**Shipped this session (all on `main`):**
- **Lane-drag camera hold** (`holdCamera` / `onLaneDragChange`) — a cross-lane drag mid-playback
  holds the timeline camera so the block is a stable target; snip/mend stay ungated. Plus the
  **now-frontier guard** (the still-growing live segment can't be dragged; a snip frees the bounded
  pieces behind it via `applySplits`) and **`carveLiveBlock`** (saving a live piece carves its range
  out so there's no duplicate). **Live-block start anchored** to the real session start (not the
  optimistic `liveSince`) → no pre-start sliver / "no playable footage" save fail.
- **Two real bugs surfaced via a data-only go-live:** `captureConfig` now deep-merges `air` per-key
  (a partial persisted `air` was silently disarming camera/audio); `broadcastStore.liveSince` reads
  `serverNow()` (was `Date.now()` — universal-clock violation).
- **Now-edge live feed** — riding the now edge while broadcasting shows the **actual live camera
  feed** (RTCView of `broadcastStore.liveStreamUrl`, published by `StreamScreen`), not the
  seconds-behind VOD. CONTENT.md §6 "the live edge's media is the live stream."
- **Playback hardening** (ported from `ClipEditScreen`): tolerant + back-pressured seeks (seekBy,
  ready-gated, latest-target-wins) + a stuck-`loading`/`error` **recovery** (refetch token +
  `replaceAsync`, capped + backoff, poster fallback); **play-from-paused seek-kick** (a paused
  expo-video player needs a seek to start rendering); **preview-play while scrubbing** (play muted →
  continuous repaint, settle-pause on release) for fluid scrub. Scrub cadence tightened (40ms
  throttle / 50ms follow).

**OPEN — the live-replay dead zone (`CONTENT.md` §6 "The recording lag & the dead zone"):** the
heart of "scrub the recent past while broadcasting shows 30s-old footage / no preview of the building
clip." Root cause: the **recording trails the live moment by 20–40s** (encode → upload → write →
finalize → playlist + player hold-back), so a recent-past window — the **dead zone** — has *already
happened* but **isn't recorded/served yet**. There is **no correct frame** to show there (the VOD
lacks it; the live feed is "now"). Compounded app-side by the player holding a **stale playlist
snapshot**. **Handling is undecided** (leading: **B** honest "catching up" placeholder + **C** shrink
the zone — app-side playlist refresh + recorder-side shorter segments / less hold-back). **The durable
cure is recorder/backend-side** (CONTENT.md §9 "Minimise the recording lag / dead zone"). **Next step
with Aaron:** measure the actual dead-zone width + split true recorder lag vs the app's stale snapshot
(the fixes differ). Captured 2026-06-16; nothing built yet.

---

## Updates — June 2026 (Time Machine — globe replay wired to the clip feed)

The Time Machine app consumer is built on `design`. Scrubbing the globe clock into
the past now repopulates the globe with **only the surviving public clips alive at
the playhead** (CONTENT.md time-machine model); tapping a clip pin opens it in a
replay viewer seeked to that instant. The backend was already ready — Aaron's
**C4.5** made `GET /clips/discover?at=` a LEFT JOIN so it returns BOTH
recording-sourced and buffer-promoted clips (honouring the clip's current
reversible precision + identity), plus `GET /clips/:id` for playback — so this was
pure app work. Built on the now-solid clip-playback foundation.

### What was built (app, `design`)
- **`src/api/clips.ts`** (new) — `clipsApi.discover(atISO)` → `GET /clips/discover`
  (returns `ClipPin[]`: `{id, recordingId, title, lat, lng, locationPrecision,
  seekOffsetSec, clipStartMs/EndMs, subscribersOnly, host}`); `clipsApi.get(id)` →
  `GET /clips/:id` (the playable `manifestUrl` + host; 403 on subscribers-only).
- **`src/hooks/useHistoricalClips.ts`** (new) — TanStack query, disabled at offset 0,
  query key bucketed to 5s so the pin set refreshes as the playhead advances without
  thrashing; `placeholderData` keeps prior pins on screen between fetches (no flicker).
- **`GlobeScreenMapbox` seam** (the documented TIME MACHINE SEAM, now implemented):
  `historicalMode = timeOffsetMs > 0`; a 1s ticker (only while scrubbed) advances
  `playheadMs = Date.now() − timeOffsetMs`; a **memoised `pins`** swaps the live
  viewport `streams` for `clipPins.map(clipToStream)` (clips mapped into the `Stream`
  shape so the whole pin renderer + clustering + card path is reused — referentially
  stable so the card-sync effects don't loop). `clipPinById` recovers clip-ness:
  `toDiscovery` gives clip pins `kind:'clip'` + a **"Watch"** CTA → `watchClip` →
  the replay viewer; live pins keep "Join". Count bubbles suppressed in the past
  (no server tile-counts for clips); `treatAsSelf` disables the black self-pin /
  return-to-broadcast for clip pins; selection clears on the live↔past boundary.
- **`DiscoveryHandoffCard`** — `DiscoveryStream` gained `kind?: 'stream'|'clip'` +
  `ctaLabel?`. A clip card shows the `ctaLabel`, no `LivePill`, and a "replay" caption.
- **Clip viewer** — new route `app/(app)/clip/[id].tsx` (singular `clip/` to avoid
  colliding with the `clips` grid tab; registered `href:null`) →
  **`ClipViewerScreen`**. Fetches `clipsApi.get(id)`, plays `manifestUrl` (expo-video,
  mirrors `ExternalStreamScreen`), seeks once to `seekSec` on first ready (single
  landing seek — the repeated-precise-seek hang only bites after many). Host identity
  chrome + back-to-globe; blocked states for subscribers-only (403, App-Store-safe:
  no in-app buy), no-media, and load error.

### Seam / lane note
The Time Machine initiative section above split this as Aaron's backend replay + the
app seam; Ben built the app consumer at his direction (same cross-lane pattern as the
clips work). Backend (`clips/discover` + `clips/:id`) is Aaron's and already shipped.

### Not yet device-tested / dependencies
- **Needs the backend deployed** on the Hetzner box (pull `clips/discover` C4.5) for
  the past to show anything; until then a rolled-back globe is empty (correct — no
  surviving clips returned).
- On-device pass owed: scrub-back populating clip pins, the 1s playhead advance
  replaying pins as time passes, clip pins clustering + the "Watch" card, the replay
  viewer (manifest load + seek-to-instant + the blocked states), and that returning
  to live (`THEN`→`NOW` / offset 0) restores the live viewport feed cleanly.
- `tsc` clean (only the pre-existing `stream/${string}` typed-route template-literal
  errors remain — unrelated). Pure JS, no native module → no EAS rebuild.

### Follow-up (same session) — source rail + broadcast clock on the viewer
The clip viewer now matches live watching + the clip preview:
- **Switchable source rail.** `ClipViewerScreen` shows the clip's **captured**
  sources (camera/audio/sensors/location/chat/identity), switchable, each replaying
  at the playhead through the live `SourceStage` visualizers (sampled by wall-clock
  `ts` via `useDataTrack` + `dataTrackRender` — same machinery as `ClipsScreen`). One
  video player on the primary track stays mounted for audio continuity while a
  non-camera source is in view; identity always present; rail ordered by
  `SOURCE_RAIL_ORDER`. Data-only clips (no camera/audio) still render — the default
  view falls to a data source.
- **Broadcast clock.** A passive `TimeScrubber` (`interactive={false}`,
  `playback={false}`) pinned above the footer reads the **real wall-clock time the
  footage was captured** (`clip.startAtMs + currentTime`), ticking as the clip plays.
- **Backend (`wrld-backend`, Aaron's lane — needs deploy):** `GET /clips/:id` now
  `include`s the clip's enabled `tracks` (`kind`/`manifestUrl`/`dataUrl`, durable
  public `/media/clips` URLs); `startAtMs`/`endAtMs` already came through as Numbers
  via the `convertBigInts` preSerialization hook. Additive (non-breaking).
  `clipsApi`/`ClipDetail` gained `startAtMs`/`endAtMs`/`tracks`. Until this deploys,
  the viewer plays the primary track but the rail is identity-only.

---

## Updates — June 2026 (Public buffer + one-store / retain-in-place model — DECIDED, principle only)

Decided with Ben 2026-06-18 (CONTENT.md §3 is canonical; §1.3/§1.5/§2.5/§5/§7/§8/§9
updated). **Principle settled; no code yet** — the implementation path is
`HANDOFF-public-buffer-onestore-2026-06-18.md`.

### The model
- **Path A — the rolling buffer is PUBLIC by default** and available in the time
  machine (not just deliberately-saved clips). Per-range **private** is the opt-out
  (watchable live, kept if retained, never in the past). **Live is always public by
  product policy** (the model permits private-live; we don't expose it).
- **One footage store; saving is retain-in-place, not a copy.** Supersedes the
  two-pool / copy-on-save (`promoteBufferClip` copying bytes) model. A clip is a
  manifest of **per-range directives** over one store; **retention (reap↔keep)** and
  **visibility (public↔private)** are two **orthogonal** per-range axes (all four
  cells valid, incl. private+saved). The **reaper is a manifest consumer**: a segment
  survives iff a `retain` directive pins it (or it's live). Saving shifts bytes from
  the time-window budget onto the saved-storage quota — re-tagged, never moved.
- **Per-range directives** (supersedes per-clip identity/precision): every directive
  travels with the range, so snip/mend needs **no reconciliation** when adjacent
  ranges agree; when they differ, mend is guarded (disable / prompt), and keeping
  them snipped is always valid.
- **Unchanged:** saved = storage-quota'd, buffer = time-windowed; saving decrements
  available storage; **moderation hold + permanent-delete remain the only genuine
  copies**; the snip/mend + two-lane UX.

### What this supersedes (blast radius)
- CONTENT.md §3 "two physical pools" + §5 "promote-on-publish materialises bytes" →
  one store, retain-in-place.
- Backend `promoteBufferClip` (copy-out) → a `retain` directive the reaper honours.
- Per-clip `attributed`/`locDisplayPrecision`/`visibility` → per-range.
- Time machine = saved clips only → public buffer + retained public clips.
- The buffer's "never expose a regular user's buffer publicly" wall → a public buffer
  serve + token-mint policy (private ranges + owner editing stay owner-gated).

### Cross-repo
App (Ben): per-range directive UI (visibility toggle + the snip/mend differ-guard),
public/private affordance, time-machine consumer over the public-buffer discover feed.
Backend/recorder (Aaron): reaper honours per-range `retain` (drop copy-out), public
buffer discover + serve, per-range manifest fields, retained-bytes quota accounting.
Full staged plan + split: `HANDOFF-public-buffer-onestore-2026-06-18.md`.

---

## Second-planet initiative — "Haven" for private-location streams (June 2026)

> **Branch: `planet`** (off `main`, both `wrld-app` and `wrld-backend`). Net-new
> feature, not yet merged. Crosses the Ben/Aaron seam by design (Ben directed it) —
> the globe screen + backend discovery are touched directly on this branch.

**The need.** A creator who broadcasts with **PRIVATE** location
(`locationPrecision = 'off'`) was filtered out server-side and **undiscoverable**.
They now get a home: a **second planet** (99% water, one island) reached via a
**planet switcher** on the globe that glides between worlds. Built as an
**extensible planet registry** so more planets drop in as config.

**Planet registry (`src/lib/planets/`).** A planet is *data*, not a code path —
`{ styleURL | styleJSON, surfaceColor, initialCamera, belongsTo(stream),
placePin(stream)→[lng,lat] }`. `GlobeScreenMapbox` reads everything from the active
planet; no per-planet branching. Adding a planet = one object in `PLANETS`.
- **Earth** — `StyleURL.Light`; located streams (`precision !== 'off'`); pin at real
  coords; auto-rotates + GPS-orients (unchanged).
- **Haven** — synthetic in-code `styleJSON` (water `background` + one island
  `fill`/`line` GeoJSON, `island.ts`), rendered `projection="globe"`; PRIVATE
  streams only; each placed at a **stable** random island spot seeded by stream id
  (`randomPointOnIsland`, rejection-sampled, deterministic). Auto-rotation disabled
  (kept framed on the island).

**App pieces** (Ben's lane — features/lib):
- `src/lib/planets/{index,island}.ts` — registry + island geometry/style/placement.
- `features/discovery/PlanetSwitcher.tsx` — glass pill `‹ glyph + name ›`, chevrons +
  swipe, registry-driven (gallery + DESIGN.md Section 3).
- `src/lib/dayNight.ts` — `nightPolygon(date, alt)` (subsolar point → "sun below
  alt°" GeoJSON); the globe stacks `NIGHT_BANDS` (10 thin bands across +5°→−5°
  straddling the line, as Mapbox fills can't blur) as low-opacity `FillLayer`s on any
  **`dayNight` planet (Earth + Haven, same monochrome dusk)** → a SOFT graded frontier,
  fed `Date.now() - timeOffsetMs` (tracks the WRLD clock + time-machine scrub). **Haven
  (`dayNightLocal`)** uses `nightPolygonLocal(date, anchorLng, alt)` — real tilt but the
  sun's longitude anchored to the **viewer's local clock**, so the island reads as each
  viewer's own time of day (per-timezone → no host-location leak). Haven's skin is also
  recoloured to Earth's Mapbox-Light monochrome (light-grey sea, cream land).
- `GlobeScreenMapbox.tsx` (screens) — `activePlanetId` + `transitioning` state; style /
  geoJSON (`placePin`/`belongsTo`) planet-derived. **Swap motion = NATIVE transforms**
  on an OUTER wrapper (`glideX` slide + `glideScale` shrink), NOT the Mapbox camera
  (which stuttered): globe slides off one edge shrinking → style swaps off-screen →
  new planet slides in the other edge growing back, centred on the island (Haven) or
  user's location (Earth); direction = registry order (reversed back). Nested outside
  the non-native `globeTranslateY` view so drivers don't mix. **Globe sizing = zoom
  only:** Mapbox clips the globe to the MapView, so too high a zoom shears the sides
  flat; `Camera minZoomLevel = GLOBE_MIN_ZOOM` (0.35) floors it low enough that the
  whole planet fits the screen width (no crop) + vertical rotation works, and each
  planet's `initialCamera.zoomLevel` (0.5) is where it sits — raise for a bigger globe
  until the sides clip. (An earlier `fitScale` transform was removed — it scaled the
  already-clipped result.) `Stream` type: `locationPrecision` gains `'off'`, `lat`/`lng` nullable.

**Backend pieces** (`wrld-backend`, `planet` branch):
- `findAllLiveStreams` (discovery snapshot) now **includes `off` streams with
  coordinates stripped to `null`** (privacy: the real coord never leaves the server);
  `findStreamsNear` (geographic) still excludes `off`.
- `discoveryService` — `DiscoveryStream` widened (`lat/lng: number|null`, precision
  `'off'`); rebuildIndex + `publish('stream_started')` keep coordless pins **out of
  the geo set / tiles** (pin hash + legacy fan-out only → app gets them, viewport
  clients ignore them). `internal.ts` `streamStarted` pushes `off` streams (null
  coords) instead of skipping. `stream_ended` already fired for all streams.
- mediasoup unchanged.

**On-device tuning knobs** (numbers are first guesses): `GLOBE_MIN_ZOOM` /
`GLOBE_SPACE_ZOOM` / each planet's `initialCamera.zoomLevel` (whole-planet framing +
the vertical-rotation floor), the `TX_*` swap durations, `NIGHT_OPACITY`.
**Not yet tested on device** (flagged): the swap motion (pull-back → cover-instant →
dive-in) reading clean with no style-flash; the night terminator rendering on the
globe + tracking the time-machine scrub; vertical rotation holding at the min-zoom
floor; island pin spread; and end-to-end that a PRIVATE stream appears on Haven
(stable spot) and **never** exposes a real coordinate. Pure JS app-side (no native
module) — Metro hot-reload, no EAS rebuild. Backend needs deps + `prisma generate`
current to typecheck (this local checkout is stale).

> **Rebased onto upstream main 2026-06-18 + HAVEN DATA SEAM wired.** Main had moved
> the globe's pins from the discovery socket to **viewport-tile discovery**
> (`useViewportDiscovery`) + `useStreamsNear` (drawer) — a geographic model coordless
> PRIVATE streams can't ride. Resolved in `GlobeScreenMapbox`: **Earth** keeps the
> viewport/nearby feeds; **Haven** reads `useDiscoverySocket()` filtered to `'off'`
> (the socket snapshot/events now carry `off` streams via the backend changes), placed
> on the island by `placePin`. `planetPins` / `drawerSource` switch the pin + drawer +
> count + tap sources by `planet.id`; count bubbles suppressed off-Earth. **Follow-up
> (scale only):** the socket is always-on again — at real scale, gate it to Haven or
> add a dedicated lightweight live-`off` endpoint instead of the full discovery socket.

---

## Updates — June 2026 (Settings notifications — parity with web, 6 prefs)

`SettingsScreen` NOTIFICATIONS expanded from 2 toggles to **6**, matching the web
`/settings` page: followed-live, **a creator I subscribe to goes live**, nearby,
**tips received**, **gifts received** (off-stream only — "from your profile or a
clip"), **PPV event reminders**. Same optimistic-with-revert pattern as the
existing two. `usersApi.updateNotificationPreferences` widened to the shared
`NotificationPreferences` type (was 2 fields); `User` gained `notifyOnTip`/
`notifyOnSubscribedLive`/`notifyOnPpvReminder`/`notifyOnGift` (all returned by
`/auth/me`). Backed by the backend `notifyOnGift` + the off-stream gift push (see
`wrld-backend/CLAUDE.md` "Off-stream gift notifications"). Pure JS — no native
module, no EAS rebuild.

---

## Updates — June 2026 (Blocked users — app parity)

App side of blocked users (backend + mediasoup foundation in their CLAUDE.md
"Blocked users"). Block is bidirectional hiding; the live-room/chat boundary is
the mediasoup joinRoom gate.

- **`usersApi`** — `block(handle)` / `unblock(handle)` / `getBlocks()` + `BlockedUser`.
- **`ProfileScreen`** — a subtle "Block @handle" action (signed-in, non-own). Alert
  confirm → on success `router.navigate('/(app)/globe')` (the pair is then hidden,
  so the profile 404s). Unblock is not offered here — it lives in Settings.
- **`SettingsScreen`** — a "PRIVACY · BLOCKED ACCOUNTS" group listing who you've
  blocked (`['blocks']` query) with an inline Unblock action; empty-state explains
  the effect. Mirrors the web `/settings` Privacy section.

Pure JS — no native module, no EAS rebuild.

---

## Updates — June 2026 ("Live time" — h:m analytics + new profile stat tile)

Surfaces the backend's new **active-broadcast** metric (media actually produced, not
connection-open time — see `wrld-backend/CLAUDE.md` "hours live → active broadcast
time") as "Xh Ym" by the minute. Two app surfaces; pure JS, **ships next EAS build**
(no native module, no deploy from the box).

- **`AnalyticsScreen`** — the Streams KPI sub-label uses the screen's existing local
  `watchLabel(broadcastSeconds)` (`Xh Ym`) instead of `${hoursStreamed}h`.
- **`ProfileScreen` (NEW tile)** — the public profile stat row gains a third tile
  `FOLLOWERS | FOLLOWING | LIVE TIME`, rendering `broadcastSeconds` via a local
  `liveTimeLabel` (`Xh Ym`). **Gated on `broadcastSeconds > 0`** so non-broadcaster /
  viewer profiles stay the clean two-tile row (no "0m" clutter); creators who've
  streamed get the tile. (The profile screen previously rendered no hours stat at all.)
- **Types** — `broadcastSeconds: number` added to `PublicUser` + `AnalyticsSummary`.
  The backend already returns it on `GET /users/:handle` + `/users/me/analytics`
  (deployed 2026-06-23); `hoursStreamed` kept there for back-compat.
- On-device note: the profile row now centres three tiles where it centred two —
  glance at narrow-screen spacing with a wide value ("1h 26m") on the next build.

**Me-tab passport tile (follow-up, same day).** The public-profile tile is
practically unreachable for yourself (nothing links to your own `ProfileScreen`),
and the Me tab is Pro-gated only via Analytics — so own "Live time" was effectively
invisible to non-Pro users. Added **LIVE TIME as a 4th passport stat** in
`MeProfileTab` (`MEMBER SINCE · FOLLOWERS · FOLLOWING · LIVE TIME`) — always shown,
all tiers, no new navigation. It reads `profile?.broadcastSeconds` (the passport
already fetches `useUserProfile(user.handle)`); local `formatLiveTime` floors to the
minute ("0m" when none). `statsRow` is `space-between` with no fixed widths so the
4th item distributes — check narrow-screen spacing on the next build.

---

## Updates — June 2026 (Day/night terminator on the globe — IN PROGRESS, KAN-52)

A day/night terminator + shaded night side on the discovery globe
(`GlobeScreenMapbox.tsx`). **The work is UNCOMMITTED** in the working tree on branch
`planet` (terminator `LineLayer` + night `FillLayer`, both driven by
`Date.now() - timeOffsetMs` so they track the live WRLD clock + the time-machine scrub,
on both Earth + Haven). It works on-device but has a residual pole artifact that is
**structural to Mapbox's globe** (Web Mercator can't represent latitudes past ±85.05°, so
Mapbox draws a degenerate pole-cap fan; a fill hides it, a line inherits it) — not fixable
within `@rnmapbox/maps`.

This forces an **architecture decision** (recorded, not yet made): (a) ship the Mapbox-fill
version and accept the minor near-equinox pole compromise; (b) prototype/migrate to a pure
three.js globe where a sun-oriented hemisphere shell is geometrically trivial — but that
unwinds Haven, viewport-tile discovery (P4), street-zoom, native clustering, and the
deliberate Mapbox decision. **Filed as Jira [KAN-52](https://aaronwyliework.atlassian.net/browse/KAN-52)**
(project KAN, Type Task, assigned Ben) — full technical context + the fork + tunable dials
live in **`HANDOFF-day-night-terminator-2026-06-22.md`**. Pure JS, no EAS rebuild. Nothing
ships until the decision is made.

---

## Updates — June 2026 (PB4 Lane A app — snips persistence + multi-axis per-segment settings)

Lane A app side of the public-buffer / one-store initiative, wired to Aaron's now-deployed
backend (snips PATCH, multi-axis directives with `sources`, `GET /buffer/session/:id`
`sourceWindows`). All on `design` → `main`, pure JS (no native module, no EAS rebuild). The
clip-EDITING paradigm is now **snip → tap-a-segment → settings shelf** (the bracket-trim grid
editor retires — confirmed with Ben 2026-06-23; the timeline survives only as a viewer/selector).

### A1 — snips server-authoritative (`0c7d5d2`)
`bufferApi.patchSessionSnips(id, [{atMs}])` → `PATCH /buffer/me/sessions/:id/snips` (authoritative
replace). `BufferSession.snips` seeded into `splitPoints` once on load (merge, don't clobber
local); a snip/mend persists the session's full snip list. User snips now survive reload +
cross-device. (`splitPoints`/`/splits` are Aaron's back-compat aliases — app uses `snips`/`/snips`.)

### A2 — multi-axis per-segment settings sheet (`5ff70ea`, `87e6d68`)
- Migrated `ClipsScreen`'s per-segment model from the boolean `privRanges` (`privacyRanges.ts`) →
  the multi-axis `segmentSettings.ts` (`SettingsRange[]`: visibility · location precision ·
  identity · per-source on/off — all axes first-class). Seeded from `session.directives` (now
  carrying `sources`).
- **Double-tap a segment → `SegmentSettingsSheet`** (the decided UX). This **displaces the
  double-tap → grid-editor** (begins the editor's retirement — option A; the grid covers viewing,
  so nothing's lost). The scab-in eye/lock scissor-row toggle is **removed** (superseded by the
  sheet). Edits flow `applySetting` → authoritative `patchDirectives` (full axes) + invalidate the
  availability feed.
- **Auto-split** now derives from ALL settings boundaries (`settingBoundaries ∪ snips`), so a
  segment is uniform across every axis (kills the straddle; makes a per-segment toggle exact).
- **Mend differ-guard** generalised to multi-axis: un-snipping two segments that differ on ANY
  axis prompts which side's settings the merged span keeps (true span-replace via the now-exported
  `coalesce` — a sources-map merge would leak the other side's flags). Note: differing settings
  keep an auto-split boundary even after the snip is gone, so the only way to truly merge two
  blocks is to equalise their settings.
- **Sources keying:** per-segment `sources` directives are keyed by **backend kind** (Aaron's
  contract / the rail's kinds set), but the sheet works in `FeedKind`. New `FEEDKIND_TO_KIND`
  (inverse of `KIND_TO_FEEDKIND`) converts at the wire boundary (feed→backend in the PATCH,
  backend→feed in the sheet's resolved sources). `SegmentDirective.sources` + `BufferSession`
  `directives[].sources` + `snips[]` added to `bufferApi`.

### A4 — viewer rail honours `sourceWindows` (`87e6d68`)
`ClipDetail` + `clipsApi.getBufferSession` carry `sourceWindows` ([{startAtMs,endAtMs,sources}]).
`ClipViewerScreen` (the time-machine watch) finds the window covering the playhead (stable ref →
no per-tick rail churn) and **hides any source toggled off there** from the rail (identity always
kept; auto-switches view via `pickDefaultView` if the current source vanishes). First cut =
app-side rail filtering; full server-side manifest exclusion is Aaron's deferred A4. The owner's
in-grid viewer is intentionally **unfiltered** (their own editing surface).

### Not yet device-tested / remaining
- **Needs an on-device pass:** double-tap → sheet on a real segment; each axis PATCHing +
  surviving reload; auto-split when a sub-range differs; multi-axis mend prompt; the time-machine
  viewer hiding a source-off window. Plus the redundant `sources:{kind:true}` (equals default —
  harmless, not dropped by coalesce; could prune later).
- **Lane B app (next):** the cacheable `(planet,t,z,x,y)` cell manager + the
  `wss://api.wrld.cam/clips/availability` push subscription — replacing the window+poll in
  `useHistoricalAvailability`. Mirror `AVAILABILITY_TILE_MS = 3_600_000` + `availabilityCellKey`
  from the backend `tiles.ts`. (Aaron's Lane B endpoints are live + verified.)
- **Editor retirement (consolidation pass, later):** delete `ClipEditScreen` + the `[Clips|Editor]`
  page-tab once the sheet has soaked; unify the dashboard/stream/clip settings into one shelf.

---

## Updates — June 2026 (PB4 Lane B app — scalable time-machine availability: space-time cells + push)

App side of PB4 Lane B (the public-buffer initiative's scale lane), wired to Aaron's deployed
backend (the `(planet,t,z,x,y)` cell GET + the `/clips/availability` push channel). On `design` →
`main`, pure JS (no native module, no EAS rebuild). **Behind a new `AVAILABILITY_TILES` RemoteConfig
flag (defaults off → inert until flipped)**, so it lands dark and supersedes the windowed feed only
when enabled.

### The model
The temporal twin of the live globe's viewport-tile protocol (P2): instead of pulling a ±12h
window for the whole world + polling every 60s (`useHistoricalAvailability`), the globe subscribes
to the **space-time cells it currently shows** — viewport × scrub-time. A cell is `(planet, t, z,
x, y)` with `t = floor(T_ms / AVAILABILITY_TILE_MS)` (1h slices). High zoom → individual pins
(resolved locally by `playhead ∈ interval`); low zoom → a per-minute alive-count series read at the
playhead minute → count bubbles (the windowed feed never had historical counts).

### What shipped (`design`)
- **`src/lib/tiles.ts`** — `AVAILABILITY_TILE_MS = 3_600_000` + `availabilityCellKey(planet,t,z,x,y)`,
  mirrored byte-for-byte from `wrld-backend/src/lib/tiles.ts` (client + server build the key
  identically — the push channel emits these keys and the client subscribes by them).
- **`src/api/clips.ts`** — `clipsApi.discoverCell(planet,t,z,x,y)` → `GET /clips/discover?planet&t&z&x&y`
  (cacheable: `Cache-Control max-age 30` + ETag) + the `AvailabilityCell` discriminated type
  (`{mode:'pins', clips, bufferPins}` | `{mode:'counts', bucketMs, counts}`).
- **`src/hooks/useHistoricalCells.ts`** (new) — the cell manager. `setView(bounds, zoom)` (same
  shape as `useViewportDiscovery`); derives the needed cells from viewport × scrub-time-tile (count
  mode = the whole world at a low zoom, stable as the globe spins; pins mode = the viewport bbox).
  Holds the cell GETs via **`useQueries`** so the set auto-fetches/dedups/GCs as you pan + scrub
  (`staleTime 30s` = the cell `max-age`; off-screen cells become inactive + collect). One WS to
  `/clips/availability` subscribes the held cell keys (authoritative `{type:'subscribe', cells}`
  re-sent on set change) and **invalidates just the changed cell** on `{type:'cell_changed', cell}`
  — no poll. Returns raw pins (the globe resolves intervals) + playhead-resolved count bubbles +
  `mode`.
- **`GlobeScreenMapbox.tsx`** — the `AVAILABILITY_TILES` path supersedes the windowed feed
  (`withIntervals = availabilityEnabled || tilesEnabled` reuses the existing `inInterval` +
  signature memos for pins); surfaces **historical count bubbles** at low zoom; drives the cell
  feed's `setView` from the same `pushViewport`. Time-machine is an Earth concept, so the cells
  query `'earth'`. The legacy `?at=` + windowed paths stay as the fallbacks until this soaks.

### Verified / status
Verified against the **deployed** backend: the cell GET pins/counts shapes + the
`/clips/availability` push route (subscribe → `cell_changed`, key `planet/t/z/x/y`) match. `tsc`
clean. **Not yet device-tested** — needs an on-device pass with `AVAILABILITY_TILES` flipped on:
scrubbing back populates clip/buffer pins from the cells, count bubbles at low zoom in the past,
re-subscribe on pan/rotate, and an edit pushing `cell_changed` → the cell refreshing. **P5** (retire
the legacy global-snapshot/windowed paths) follows a soak.

### Also live now (Aaron, this round) — full "show all armed sources"
Aaron landed the first-state-at-go-live backend (mediasoup chat initial empty-thread + "report
armed-empty data tracks") + per-segment title/tags carried through promote. Combined with the app's
go-live baseline emits (sensors + torch), **every armed source now records a first state**, so the
clip editor's captured-only shelf shows all armed sources (incl. chat, location) without disabled
placeholders.

---

## Updates — June 2026 (Segment settings shelf + universal timeline foundation)

Per-segment manifest editing UX + the first real step toward one timeline implementation. All on
`design` → `main`, pure JS (reanimated/RNGH/expo-video/expo-image already in the dev client) — **no
EAS rebuild**. Needs an on-device pass (the shelf interactions + the reanimated scrub feel).

### Segment settings shelf — `SegmentSettingsSheet`
**Double-tap a clip block** on the Clips grid → the per-segment shelf (supersedes the scab-in
eye/lock toggle AND the bracket-trim grid editor — its double-tap entry retires). Every control is a
**multistate toggle**, fixed order top→bottom: **viewer/timeline/transport** (`SegmentPreview`) ·
**Lane** (BUFFERED|SAVED — saves/un-saves; hidden once the reaper reaches the segment) · Visibility
(PRIVATE|PUBLIC) · Identity (ANON|SHOWN) · Location (OFF|COUNTRY|CITY|EXACT) · captured sources
(camera·audio·chat·compass·gyro·accel·speed·torch, OFF|ON) · **Tags**. Off/least reads left.
Per-segment **title** (editable) + **tags** are first-class axes now (persist via the directives
PATCH + carry through promote — Aaron). `loc` dropped from the per-source rows (the Location
precision axis covers off). Scrollable (grows with content, capped 85% screen); dismiss via
tap-outside · X · drag-down, animated.

### `SegmentPreview` — the shelf's viewer + mini timeline + transport
Square clip viewer (`expo-video`, `contentFit:contain` → letterbox/pillarbox) + title/date/time,
then a thin clip timeline (clip skates under a static centre playhead, half-field head/tail) + a
transport (`BufferTransport` with `showBufferEdges={false}` → snaps to the clip's own head/tail).
Starts paused. Player teardown guarded (`aliveRef`/`safe()` — closing the sheet released the player
→ FunctionCallException, fixed).

### Universal timeline foundation (DESIGN.md decision log 2026-06-24)
Locked the **core timeline principles** (static centre playhead · half-field head/tail · the
film-cell white/outlined block · drag-scrub with release inertia · pinch-zoom) — universal; lane
count / gaps / height / reaper edges vary on top. Two shared layers extracted so timelines can't
drift:
- **`FilmStrip`** (`features/clip/FilmStrip.tsx`) — the block visual (sprocket bands +
  constant-size square poster cells), extracted from ClipBlock's internal FilmRow; **ClipBlock +
  SegmentPreview both render it**. Fixes the shelf's "darker paper" drift (its film container was
  `panelHi`; the page's is the lighter `bg.primary` — matched).
- **`useTimelineScroll`** (`features/clip/useTimelineScroll.ts`, **scope A**) — the reanimated
  scroll engine (progress+zoom, pan→scrub + clamped `withDecay` inertia, pinch pinned to centre,
  throttled seek gated to scrubbing). SegmentPreview uses it (dropped its `Animated.decay` copy) →
  the feel is the engine, not an approximation. The standard for new single-span timelines.
- **Scope B (scoped, NOT done):** migrating `ClipsTimeline` onto the hook — its engine is fused
  with the collapsed-gap axis / reaper gap-rush / live build / server clock; would need a mapping
  param + frontier plugin and must not regress the `clips-timeline-clock-v1` milestone. High risk /
  dedup-only reward → do on real drift or a third gap/reaper timeline (rule-of-three). Insight in
  DESIGN.md §6.

### Backend follow-up (Aaron, flagged in HANDOFF-pb4)
Edited per-segment **title** must proliferate to the time-machine **pin card** — `GET
/clips/discover` selects `Clip.title`/`Stream.title`, not the covering directive's title; it should
`COALESCE` the directive title (same pattern as reversible location precision). The app already
renders `pin.title`, so it's backend-only.

---

## Updates — June 2026 (Profile saved-clips: in-place pref editing + buffer-window divider)

Profile / Me-tab saved-clip feed gets in-place editing + a reaper divider; all on `design`, pure JS
(no native module, no EAS rebuild). Local-only until Aaron's back.

- **Saved-clip rows edit prefs in place (no navigation).** `MeProfileTab`'s saved-clip rows no
  longer deep-link to the clips page; tapping a row opens the per-clip settings **drawer** in place
  to edit that clip's preferences. The retired path (the old clip-edit grid, and the earlier
  this-session `?openClipId` deep-link into ClipsScreen) is removed.
- **New `SavedClipSettingsSheet`** (`features/clip/`) — standalone host for `SegmentSettingsSheet`
  over a single durable `SavedClip`, for surfaces without the Clips-grid session/directives
  machinery. Reads the clip's own fields; writes via `bufferApi.patchClip` (saved-clip edit, C4.4);
  delete via `deleteSavedClip`; invalidates `['buffer','clips']` + `['historical-availability']` so
  an edit proliferates to the time-machine pin/replay. Axes = Ben's profile-edit set: **title ·
  location precision · identity · per-source on/off · delete.**
- **`SegmentSettingsSheet` gained `showVisibility` / `showTags`** (default true). The saved-clip read
  doesn't expose visibility/tags yet (the backend `Clip` row has both; the list serializer omits
  them), so the standalone editor hides them — full parity is **HANDOFF-unified-manifest contract
  #12** (Aaron: surface `visibility`+`tags` on `GET /buffer/me/clips`; note the `public|anon|draft`
  vs PB4 `private|public` vocab gap).
- **Buffer-window divider on the feed.** Newest-first, split at a divider: above = clips still
  inside the rolling-buffer window; below ("SAVED · PAST THE BUFFER WINDOW") = clips the reaper has
  moved past, kept only because saved. Floor = `now − windowHours` (server clock via `useBuffer`).

**Time-machine proliferation status (answer to "when do edits show on past pins?").** The discover
query already reads the clip's **current** values — location precision via `COALESCE(c.locDisplayPrecision,
s.locationPrecision,'exact')` (decision A) and identity via `c.attributed` (anon → host null); the app
renders `pin.title`/host from the feed, so **no app change is needed for these to update** — it's
**deploy-gated** (the box must run the decision-A/C4.5 build). The **new profile drawer is the most
direct write path**: `patchClip` sets exactly the discover/viewer fields (`c.title`, `c.attributed`,
`c.locDisplayPrecision`, sources). The one true gap is **per-segment title edits on the clips page**,
which write `DirectiveRange`s, not `c.title` → those need the directive-title COALESCE (contract #10).
Source access shows through the clip viewer (`GET /clips/:id` tracks + the rail's `sourceWindows`).

---

## Updates — June 2026 (Unified manifest U1 app slice — go-live lane wired)

Aaron landed U1–U5 backend/mediasoup (all deployed 2026-06-25); the app slices are Ben's. **U1
done** on `design` → `main` (`a821d27`). Pure JS — no native module, no EAS rebuild.

- **`captureConfig.lane: 'buffer' | 'saved'`** (default `buffer`) — the now-edge starting lane; the
  dashboard loads/saves/auto-persists it like the other arming fields.
- **`LaneToggle` wired into `DashboardScreen`** (after the source groups) — the already-built
  BUFFER|SAVED flag-row; its value forwards on go-live.
- **`createRoom` carries `lane?: 'buffer' | 'saved'`** (mediasoupSignaling client message + method,
  `useSignaling`, `StreamScreen.handleGoLive` → `createRoom({ lane: c.lane })`). Omitted → buffer.
  Aaron's engine stashes it on `room._meta.lane` → `BufferSession.lane`; a `saved` session is
  retained from go-live (never reaped).
- **`BufferSession.lane?`** + **ClipsScreen renders a `lane:'saved'` session in the SAVED lane**
  (live block + ended, not-yet-materialised sessions) and excludes it from the buffered carve. Gated
  purely on `lane === 'saved'`, so existing buffer/absent-lane data — and the
  `clips-timeline-clock-v1` milestone behavior — is untouched. (U1 caveat: a saved-lane session
  isn't a durable `Clip` yet — materialise + quota + the storage cap are U3 — so it shows on the
  clips timeline but not the profile feed until U3.)

**On-device verify owed:** go live tagged `saved` → footage isn't reaped + shows in the saved lane.

**Remaining app slices (Aaron's backend deployed):** **U3** (revert the reaper-disable guard;
edge-relative save `fromReaperEdge`/`toNow`; save↔buffer = successive saves; `409 storage_cap` →
warn + flip to buffer), **U4** (live cam/audio rail → `setSourcePaused` + the U2 snip; viewers
handle `producerPaused`/`producerResumed`). **U5** needs no app change.

### U2 — live snip-at-now (DONE 2026-06-25, `24323e9`)
The dashboard is the now-edge editor: while live, a per-range **metadata** change snips the open
buffer session. `bufferApi.snipSession(id, settings)` → `POST /buffer/me/sessions/:id/snip` (+
`SnipSettings`). The dashboard (no live hooks) signals via a new `broadcastStore` snip channel
(`pendingSnip`/`requestSnip`/`consumeSnip`, mirroring the command pattern); the mounted StreamScreen
executes the snip against the OPEN session (id from `useBuffer`; dropped if not yet created) then
re-emits each armed sensor's first state via `useTelemetryCapture.reemit()` (its go-live baseline,
extracted + returned) so the new era is self-contained. The dashboard fires a debounced (600ms)
snip on **location-precision · identity · title** changes (skips the first-live baseline + no-ops),
scoped to the cleanly-mapping metadata axes — `sources` omitted (partial-map risk; chat + AV source
toggles are U4), `visibility` = server default public, no tags control. Pure JS, no rebuild. Not
device-tested.
