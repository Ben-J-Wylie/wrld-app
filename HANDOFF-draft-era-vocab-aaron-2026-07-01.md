# HANDOFF (Aaron) — go-live speaks Era vocab; `Recording.kinds → sources`

> **One idea:** the app is being de-klugged so a go-live is authored as a **draft Era** (`Partial<Era>`,
> in the Era's own vocabulary) and *stamped* at go-live. Today the wire uses a **third dialect**
> (`air`/`lane`/`locationPrecision:'off'`) that gets translated **twice** — once app-side, once in the
> backend mint — including a pointless `private → off → private` round-trip on precision. This closes
> that: **the app sends Era vocab; the backend stamps the Era with no translation.** Ben + Claude
> designed it; this is the backend half, through to deploy.

## Why (the shape of the kludge)
The go-live mint is **two hops**, and the Era's values are minted *from the Stream row*, not the app:

```
app createRoom ──▶ POST /internal/streams/started ──▶ Stream row
                                                          │
mediasoup first-produce ──▶ POST /internal/recordings/allocate (reads Stream) ──▶ Recording + opening Era
```

Current dialects + the translations they force:
- `air` (FeedKind map) →(app)→ `sources` (kinds)  — dying app-side with the draft.
- `precision:'private'` →(app `precisionMap`)→ `locationPrecision:'off'` → Stream → **(allocate) `'off'→'private'`** → Era. A full round-trip to end up where it started.
- `lane:'buffer'|'saved'` → **(allocate) → `keep:'reapable'|'kept'`**.
- `identity` — **dropped entirely today** (the app never sends it; the era defaults `shown`).
- `Era.sources` — created **`{}`** at allocate (never populated from the armed set).

## The target: app sends Era vocab; the mint is a pass-through

### 1. New go-live wire contract (`/internal/streams/started` `StartedBody`)
The app will send **Era vocabulary**. Rename/accept:

| today (drop) | → new (Era vocab) | values |
|---|---|---|
| `locationPrecision` | **`precision`** | `exact \| city \| country \| private` (no more `'off'`) |
| `lane` (on `allocate`) | **`keep`** | `reapable \| kept` |
| — (dropped) | **`identity`** (add) | `shown \| anon` |
| — | **`tags`** (add, optional) | `string[]` |
| — | **`contentRating`** (add, optional) | `general \| adult`, default `general` |
| `sources` | `sources` (unchanged) | `kind[]` (backend kinds; the app already sends these) |
| `title`,`lat`,`lng`,`subscribersOnly`,`visibility`,`ppvEventId` | unchanged | |

> **Testing mode → clean cutover, no back-compat.** DB + storage are already wiped; don't dual-accept
> the old dialect. Flip the contract.

### 2. Stamp the Era from the draft (no translation, all axes populated)
At the mint (wherever you keep it — `allocate`, or fold the era-relevant fields forward from `started`):
- **`precision`** — store the app's value **directly** (`private` stays `private`). Kill the
  `'off'→'private'` line. *(The Stream's live-discovery obfuscation is the ONE place `'off'` may still
  be needed — see §4; that mapping lives backend-side, never on the app.)*
- **`keep`** — from `keep` directly (drop the `lane === 'saved' ? …` map).
- **`identity`** — from `identity` (this now flows; today it's lost).
- **`sources`** — populate `Era.sources` from the armed set (`{ [kind]: true }` for each armed source),
  **not `{}`**. This is the per-era exposure rule; birth = all captured exposed.
- **`tags`**, **`contentRating`** — from the draft.
- `title`, `visibility`, `subscribersOnly`, `ppvEventId` — as today.

The Era must carry identity/keep/tags/contentRating, which the **Stream row doesn't hold today**. Your
call how: (a) add them to the Stream row so `allocate` reads them, or (b) pass them straight to
`allocate`. (b) is cleaner — it decouples the Era mint from the Stream projection.

### 3. `Recording.kinds` → `Recording.sources` (schema rename)
Reserve **`kind`** for the *type* and **`source`** for the *channel*. Rename the column
`Recording.kinds: String[]` → **`Recording.sources: String[]`** (the captured channels). Then:
- `Recording.sources: kind[]` = captured facts (which channels exist on disk),
- `Era.sources: Json` = exposure rule (which of them this era reveals),

one noun (`source`), one type (`kind`). Update `recordingMedia.ts`, `reapRecordings`, the `/eras`
serve/discover/timeline reads, and the recorder's write path (the footage layout
`buffers/<userId>/<recordingId>/<kind>/` is unaffected — that's keyed by `kind`, correct).

### 4. Stream-side precision (`'off'`) — one backend mapping, if any
`Stream.locationPrecision` uses `'off'` for live-discovery exclusion (getDisplayCoords / geo tiles).
Either (a) migrate `Stream.locationPrecision` to Era vocab (`'private'`) and treat `'private'` as the
exclusion in discovery, or (b) map `precision:'private' → Stream '.off'` **once**, at
`/internal/streams/started`. Either is fine — the point is the app never sees `'off'` again. (b) is the
smaller change.

## Deploy sequence (coordinated cutover — testing mode)
1. **Aaron (this repo):** implement §1–§4 → `prisma migrate` (the `Recording.sources` rename) →
   `prisma generate` → build + typecheck → **deploy to the box** (pull on Hetzner, restart API +
   mediasoup). Wipe is unnecessary (additive to Era rows); the `kinds→sources` rename is a column rename.
2. **Signal Ben** the box is running the era-vocab contract.
3. **Ben/Claude (app):** flip `createRoom` to send the draft (Era vocab) — the app change is ready
   behind a one-line `draftToWire()` seam; on your signal it sends era-vocab directly and the seam is
   deleted. No app rebuild (pure JS, hot-reload).
4. **Joint on-device test** (below).

Because both sides cut over together, **no dual-accept / back-compat is needed** — one contract, one
deploy.

## Test checklist (on device, after deploy)
- Go live with camera+audio+location armed, title set, precision **CITY**, identity **ANON**, lane
  **SAVED** → confirm the opening `Era` has `precision:'city'`, `identity:'anon'`, `keep:'kept'`,
  `sources:{camera:true,audio:true,location:true}`, `title` set. (Today identity + sources would be
  wrong/empty.)
- Confirm `Recording.sources` lists the captured kinds; footage lands under
  `buffers/<userId>/<recordingId>/<kind>/`.
- A **data-only** go-live (location only, no camera/audio) still mints a Recording + Era with
  `sources:{location:true}`.
- Live discovery still obfuscates a `precision:'private'` (Haven / excluded) stream correctly (§4).
- Time-machine pin + clip viewer read the new Era values (precision/identity honoured).

## Not in this handoff (separate, parallel)
- **`FeedKind → kind`** rename is app-side only (the wire already uses backend `kind` names for
  `sources`); it doesn't touch the backend.
- The clip **report route** (`POST /eras/:id/report` → `captureReportEvidence`, `targetType:'clip'`)
  is a separate small backend add (the app's `erasApi.report` already calls it).
