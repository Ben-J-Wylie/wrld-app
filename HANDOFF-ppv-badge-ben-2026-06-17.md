# HANDOFF — PPV badge + event title in the stream view (Ben, 2026-06-17)

> From Aaron's PPV app-parity port (`2feeb56`). Everything else from that port
> shipped (join-by-room fix, late-producer consume, waiting-room push, viewer
> pause/resume, cancel-ticket, end-event guard). **This one piece was deferred to
> your lane** because it lives in the identity readout — a design-system component
> (`SourceIdentityCard` / the live identity surface), and I didn't want to fork it
> out from under your source-visualizers/SourceStage work.

## What's missing

A live PPV broadcast looks identical to a normal stream. We want it to read as
PPV, on both the **viewer** and the **broadcaster** live surfaces:

- a small **PPV** badge (amber, next to LIVE), and
- the **event title** shown as the title/identity line (not the raw stream title).

Mirror the web, which already does this (reference implementations):
- **Viewer** — `wrld-web/src/components/stream/StreamViewer.tsx`: amber `PPV`
  pill beside the red `LIVE` pill; `ppvEvent.title` rendered as the title line
  instead of `stream.title`.
- **Broadcaster** — `wrld-web/src/components/stream/Broadcaster.tsx`: same badge +
  the event title up top while live.

## The data is already wired — you only need to render it

### Viewer side — `stream.ppvEvent`
- `Stream` type now carries `ppvEvent?: { id: string; title: string; status: string } | null`
  (`src/types/index.ts`).
- The backend populates it: `getStreamByRoomId` includes the linked PPV event, so
  `streamsApi.getByRoom(roomId)` returns it. **No backend work needed.**
- In `StreamScreen`, the viewer's stream is **`streamByRoom`** (from
  `useStreamByRoom(...)`). So `streamByRoom?.ppvEvent` is your source:
  - `ppvEvent` truthy → render the PPV badge + use `ppvEvent.title` as the
    identity title.
  - null → normal stream, unchanged.

### Broadcaster side — `ppvTitle` via `activeBroadcast`
- The broadcaster knows the event id (`activeBroadcast.get()?.ppvEventId`), but not
  the title yet. `BroadcastParams` (`src/lib/activeBroadcast.ts`) currently is
  `{ ppvEventId?: string }`.
- Add `ppvTitle?: string` to `BroadcastParams`, and have **`DashboardScreen`** set it
  when it sets `ppvEventId` (it already has the selected event in `myEvents` /
  `enforcedEvent` — pull the title from there). One line each.
- Then on the broadcaster live surface, read `activeBroadcast.get()?.ppvTitle` to
  show the badge + title. (Web passes the same value through and renders it
  identically.)

## Where to put it

Your call — two clean options:
1. **Inside the identity readout** (`SourceIdentityCard` / the `profile` source
   view) — most consistent with the "every surface is a source" model; the title
   line becomes the event title and the PPV pill sits with LIVE.
2. **A small standalone PPV pill** in the always-visible top cluster
   (`viewerActions` / the broadcaster top cluster) — lighter touch, no change to
   `SourceIdentityCard`. The `LIVE`/identity chips already live there.

I'd lean (1) for parity with web, but (2) is lower-risk if you'd rather not touch
`SourceIdentityCard` mid-source-parity.

## Notes

- Pure JS — **no native module, no EAS rebuild**.
- The `status` field on `ppvEvent` is the event's status at fetch time (`'live'`);
  you only need `title` for the badge. (`status` is also used by the pause-vs-end
  detection elsewhere — don't need it here.)
- Web uses an **amber** pill (`#f59e0b`-ish) for PPV to distinguish from the red
  LIVE; match to the app's accent/amber tokens.
