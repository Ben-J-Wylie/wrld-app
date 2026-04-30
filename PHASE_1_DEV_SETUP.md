# WRLD Alpha — Phase 1: Dev Environment & Project Foundation

This guide gets `wrld-app` from a bare Expo init to a properly structured React Native (TypeScript) project ready for auth, navigation, state, and feature work. Steps work on **both Mac (Ben) and Windows (Aaron)** — platform-specific notes are called out.

---

## 0. Prerequisites check

Both of you should have these. Verify in a terminal:

```bash
node --version    # v20.x or v22.x (LTS)
npm --version     # v10+
git --version     # any recent
```

**Windows-specific (Aaron):**
- Use **PowerShell** or **Windows Terminal** — not legacy `cmd.exe`. Path handling is more predictable.
- Make sure **long paths are enabled** (Expo deps nest deep): run as admin once:
  ```powershell
  git config --system core.longpaths true
  ```
- Install **Watchman** is *not* required on Windows; Metro uses an alternative file watcher.

**Mac-specific (Ben):** Watchman is recommended:
```bash
brew install watchman
```

**Both:** Install the **Expo Go** app on a physical phone for testing, OR set up a simulator (iOS Simulator on Mac, Android Studio emulator on Windows).

---

## 1. VS Code setup

Install these extensions on both machines:

| Extension | Purpose |
|-----------|---------|
| ESLint (dbaeumer.vscode-eslint) | Lint on save |
| Prettier (esbenp.prettier-vscode) | Format on save |
| TypeScript and JavaScript Language Features (built-in) | TS support |
| Expo Tools (expo.vscode-expo-tools) | Expo Router intellisense, app.json schema |
| EditorConfig (editorconfig.editorconfig) | Cross-platform formatting consistency |
| Error Lens (usernamehw.errorlens) | Inline error display |
| GitLens (eamodio.gitlens) | Git history in editor |

A `.vscode/extensions.json` is included in the repo setup below so VS Code prompts both of you to install these automatically.

---

## 2. Project structure

We're going to flatten the bare Expo init and rebuild with a proper structure. From the existing `wrld-app` directory:

### 2.1 Clean slate (run once, by Ben)

```bash
cd wrld-app

# Back up anything you want to keep
git checkout -b phase-1-foundation

# Remove the default Expo Go stub if it's still there
rm -rf app-example  # only if it exists from `npx create-expo-app`
```

### 2.2 Install core dependencies

```bash
# Navigation (Expo Router — file-based, deep-link friendly)
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar

# State management
npm install zustand @tanstack/react-query

# Async storage for persisted state (auth tokens, etc.)
npx expo install @react-native-async-storage/async-storage

# Forms & validation
npm install react-hook-form zod @hookform/resolvers

# HTTP client
npm install axios

# Utilities
npm install date-fns

# Dev tooling
npm install -D typescript @types/react @types/react-native \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-config-prettier eslint-plugin-react eslint-plugin-react-hooks \
  prettier
```

### 2.3 Install dependencies you'll need soon (but won't wire up this phase)

```bash
# 3D globe (Phase 5)
npx expo install expo-gl expo-gl-cpp three
npm install @types/three

# Auth (Phase 3) — Cognito SDK
npm install amazon-cognito-identity-js

# WebRTC for mediasoup (Phase 7)
npx expo install react-native-webrtc

# Mediasoup client (Phase 7)
npm install mediasoup-client
```

> ⚠️ `react-native-webrtc` requires a **custom dev client** (not Expo Go). We'll set this up properly in Phase 7. For Phases 1–6, Expo Go is fine.

---

## 3. Folder structure

Create this layout inside `wrld-app/`:

```
wrld-app/
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx               # Root layout (providers)
│   ├── index.tsx                 # Entry/redirect
│   ├── (auth)/                   # Auth route group (signup/login)
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (app)/                    # Authenticated route group
│       ├── _layout.tsx
│       ├── globe.tsx             # 3D live-stream globe (Phase 5)
│       ├── dashboard.tsx         # Stream layer arming (Phase 6)
│       └── stream/
│           └── [id].tsx          # Dynamic stream view (Phase 7)
├── src/
│   ├── api/                      # API client + endpoint modules
│   │   ├── client.ts
│   │   └── streams.ts
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Primitives (Button, Input, etc.)
│   │   └── feature/              # Feature-specific components
│   ├── features/                 # Feature modules (auth, streams, etc.)
│   │   └── auth/
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities, constants
│   │   ├── env.ts
│   │   └── theme.ts
│   ├── stores/                   # Zustand stores
│   │   └── authStore.ts
│   └── types/                    # Shared TypeScript types
│       └── index.ts
├── assets/                       # Images, fonts, etc.
├── .editorconfig
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc
├── app.json
├── babel.config.js
├── package.json
├── tsconfig.json
└── README.md
```

I've generated all the config files and starter code in this Phase 1 bundle. Copy them in.

---

## 4. Configuration files

All of these are in the bundle. Drop them in at the paths shown.

- `.vscode/settings.json` — format on save, ESLint integration
- `.vscode/extensions.json` — recommended extensions
- `.editorconfig` — line endings, indentation (CRITICAL for Mac+Windows collab)
- `.prettierrc` — code formatting
- `.eslintrc.cjs` — linting rules
- `.gitignore` — Node, Expo, OS files, env vars
- `.env.example` — template for env vars (copy to `.env`, never commit `.env`)
- `tsconfig.json` — strict TypeScript with path aliases
- `babel.config.js` — Expo Router + module resolver
- `app.json` — Expo config with deep linking scheme

---

## 5. Cross-platform git hygiene

This is critical to avoid Mac vs. Windows headaches.

### 5.1 Line endings

The included `.gitattributes` enforces LF line endings for all source files. Both of you should:

```bash
# Run once after cloning
git config --local core.autocrlf input    # Mac
git config --local core.autocrlf true     # Windows
```

### 5.2 Case sensitivity

macOS is case-insensitive by default; Linux/CI is not. Always import with **exact case**:

```ts
// ❌ Bad — works on Mac, breaks on CI
import { Button } from './components/ui/button'

// ✅ Good
import { Button } from './components/ui/Button'
```

ESLint will flag mismatches.

### 5.3 Path aliases

`tsconfig.json` defines `@/*` → `src/*`. Use it:

```ts
// ❌ Avoid
import { useAuth } from '../../../stores/authStore'

// ✅ Prefer
import { useAuth } from '@/stores/authStore'
```

---

## 6. Running the app

After dropping in all config and starter files:

```bash
# Start Metro bundler
npx expo start

# Press 'i' for iOS simulator (Mac only)
# Press 'a' for Android emulator
# Or scan the QR code with Expo Go on your phone
```

---

## 7. What's in the starter code bundle

I've generated minimal-but-correct starter files for:

| File | What it does |
|------|--------------|
| `app/_layout.tsx` | Root providers: TanStack Query, SafeArea, status bar |
| `app/index.tsx` | Auth-aware redirect (logged in → globe, logged out → login) |
| `app/(auth)/_layout.tsx` | Auth stack |
| `app/(auth)/login.tsx` | Placeholder login screen |
| `app/(auth)/signup.tsx` | Placeholder signup screen |
| `app/(app)/_layout.tsx` | Authenticated stack with tab structure |
| `app/(app)/globe.tsx` | Globe placeholder |
| `app/(app)/dashboard.tsx` | Dashboard placeholder |
| `app/(app)/stream/[id].tsx` | Stream view placeholder |
| `src/lib/env.ts` | Env var loader with type safety |
| `src/lib/theme.ts` | Color/typography tokens |
| `src/stores/authStore.ts` | Zustand auth store with AsyncStorage persistence |
| `src/api/client.ts` | Axios instance with auth interceptor |
| `src/components/ui/Button.tsx` | Reusable button primitive |
| `src/components/ui/Input.tsx` | Reusable input primitive |
| `src/types/index.ts` | Shared types (User, Stream, etc.) |

---

## 8. Verification checklist

Before merging the `phase-1-foundation` branch, both of you should confirm:

- [ ] `npx expo start` runs without errors on Mac
- [ ] `npx expo start` runs without errors on Windows
- [ ] App opens in Expo Go and shows the login screen
- [ ] Tapping "Sign up" navigates to signup screen
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No ESLint errors: `npx eslint . --ext .ts,.tsx`
- [ ] Prettier doesn't want to reformat anything: `npx prettier --check .`

---

## 9. Phase 1 → Phase 2 handoff

Once Phase 1 is merged:

1. Create a new repo: `wrld-backend` (AWS CDK in TypeScript)
2. We'll provision: Cognito user pool, DynamoDB tables, API Gateway, Lambda functions
3. Wire the app's `src/api/client.ts` to the deployed API Gateway URL via `.env`

Tell me when Phase 1 is verified on both machines and I'll generate Phase 2.
