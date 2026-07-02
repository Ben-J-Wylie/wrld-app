# HANDOFF (Aaron → Ben) — clip/era report button (backend is live)

> **Backend is deployed** (`a4b426a`). Reporting is fully wired server-side on the
> Recording+Era model. The only remaining piece is app-side: a **report entry point
> (⚑) on the era/clip surfaces**. The live-stream report button already exists; this
> is its clip/era twin. `erasApi.report` already calls the endpoint below.

## What the app wires

A report control (⚑ "Report") on the **era/clip viewer** (`ClipViewerScreen` /
`/eras/[id]`) and on **profile clip cards** — anywhere a *public* era is watchable in
the time machine or on a profile. (The live **stream** report button in the stream view
is unchanged — keep it.)

**Flow (mirror the existing stream-report sheet):**
1. Tap ⚑ → reason picker (same reasons as the stream report).
2. `POST /eras/:id/report { reason }` → `{ ok, reportId }`.
   - Auth required (`requireAuth`); a signed-out tap → the signup modal, same as other
     identity-gated actions.
   - Only a **public** era is reportable → 404 otherwise (don't show ⚑ on your own
     drafts/private eras).
3. *(optional, same as streams)* capture a screenshot at tap time and
   `POST /reports/:id/snapshot { snapshot: <base64 JPEG> }` with the returned `reportId`
   — the reporter-only, once-per-report screenshot. Reuse the exact code path the stream
   report already uses; it's the same endpoint.

That's it — no other app change. The 401/404/reason-required handling is identical to
the stream report sheet, so it should be a lift-and-reuse of that component with the URL
swapped to `/eras/:id/report`.

## Endpoint contract

| | |
|---|---|
| `POST /eras/:id/report` | body `{ reason: string }` (non-empty) → `{ ok: true, reportId }`. Auth required. 404 if the era isn't public. |
| `POST /reports/:id/snapshot` | body `{ snapshot: <base64 JPEG> }` → `{ ok }`. Reporter-only, idempotent. (Unchanged, shared with stream reports.) |
| `POST /streams/:id/report` | the existing live-stream report — unchanged. |

## What happens server-side (context, no app work)

- The report files a `Report` + surfaces it in the unified `/moderation` queue (one
  `ModerationCase` per subject; repeat reports accrete).
- The reported window is **copied into a platform-owned `Recording` + `Era`** (the same
  two objects) as the moderation footage hold — unified-manifest native. Era report →
  the era's own window; live report → `[T−60s, T+30s]` around the tap.
- The hold is owned by a system moderation user (so it survives the creator deleting the
  era/account), `keep:'held'` (never reaped), `visibility:'private'` (never on the globe).
  Moderators review it in the `/moderation` console via the normal era player.
- **Nothing the app renders** — the hold is moderator-only. The app just fires the report.

## Note
The `/moderation` **admin console** UI (wrld-admin) reads the held footage through the
new panels — that's the admin repo's lane, not the app. This handoff is only the app's
⚑ entry point.

Ping me if the reason list / sheet component differs from the stream one. — Aaron
