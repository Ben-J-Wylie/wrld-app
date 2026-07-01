# SIGNAL (Aaron → Ben) — box is running the Era-vocab contract; flip the app

> **Deployed + live on `api.wrld.cam`.** The go-live mint is now a pass-through:
> send the draft Era's vocabulary at `createRoom` and the backend stamps the opening
> Era with **no translation**. Flip `draftToWire()` to send era-vocab directly, then
> delete the seam. Backend `5a57e11`, mediasoup `32bc1ca` (both on `main`, deployed).

## What changed (backend + mediasoup, done)
- `createRoom` / `/internal/streams/started` / `allocate` now speak **Era vocab**. The
  `air`/`lane`/`locationPrecision:'off'` dialects and the `private→off→private`
  round-trip are gone.
- **`identity` now flows** (was dropped) and **`Era.sources` is populated** at go-live
  (`{ [armed kind]: true }` — birth = all captured exposed; was `{}`).
- **`Recording.kinds` → `Recording.sources`** (schema rename, migration applied on prod).
  Reserve `kind` for the type, `source` for the channel. `Recording.sources: kind[]` =
  captured channels; `Era.sources: Json` = per-era exposure rule.

## What the app sends at `createRoom` now (Era vocab)
All era fields are **optional** (backend falls back to Stream-derived defaults), so the
flip is safe even before every field is wired:

| send | values | → stamps |
|---|---|---|
| `precision` | `exact \| city \| country \| private` | Era.precision **and** Stream (mapped `private→off` backend-side for live-discovery obfuscation) |
| `keep` | `reapable \| kept` | Era.keep (`kept` = retained from go-live) |
| `identity` | `shown \| anon` | Era.identity |
| `tags` | `string[]` (≤32) | Era.tags |
| `contentRating` | `general \| adult` | Era.contentRating |
| `sources` | `kind[]` (unchanged — you already send these) | Era.sources = `{[kind]:true}` + the recorded set |
| `title`,`lat`,`lng`,`subscribersOnly`,`visibility`,`ppvEventId` | unchanged | |

**Drop:** `locationPrecision` (send `precision`), `lane` (send `keep`). No more `'off'`
from the app — `private` is the location-hidden value; the backend does the one `'off'`
mapping for Stream discovery.

## One API-response rename to pick up
`Recording.kinds` → **`Recording.sources`** in the reads you consume:
`GET /me/recordings` and `GET /eras/:id` now return `recording.sources` (the captured
channels array), alongside `era.sources` (the exposure map) and the top-level `sources`
(the per-source playable URL list). Update any `recording.kinds` reader → `recording.sources`.

## Test (on device, after you flip)
Go live: camera+audio+location armed, title set, **precision CITY, identity ANON, keep
KEPT** → confirm the opening `Era` has `precision:'city'`, `identity:'anon'`,
`keep:'kept'`, `sources:{camera:true,audio:true,location:true}`, `title` set (identity +
sources were wrong/empty before). Confirm `Recording.sources` lists the captured kinds;
footage under `buffers/<userId>/<recordingId>/<kind>/`. A **data-only** go-live (location
only) still mints a Recording + Era with `sources:{location:true}`. Live discovery still
obfuscates a `precision:'private'` stream (excluded/Haven).

Ping me if anything doesn't stamp as expected. — Aaron
