// c4smoke.mjs — C4 clip-editor backend smoke test (Test A from Aaron's handoff).
//
// Exercises the whole draft↔saved lifecycle against PROD and prints a traced,
// step-by-step report with PASS/FAIL on each assertion. Throwaway — it creates and
// then DELETES one draft/clip on your own account, leaving nothing behind.
//
//   node c4smoke.mjs "<JWT>"
//
// Get <JWT>: run the app (with the temp token log added to src/api/client.ts),
// reload, copy the `[c4-token]` line from the Metro terminal, and run this within
// ~60s (Clerk tokens are short-lived). If you see 401s, grab a fresher token.

const BASE = 'https://api.wrld.cam'
const TOKEN = process.argv[2]
if (!TOKEN) {
  console.error('Usage: node c4smoke.mjs "<JWT>"')
  process.exit(1)
}
const AUTH = { Authorization: `Bearer ${TOKEN}` }

// ── tiny test harness ────────────────────────────────────────────────────────
let pass = 0
let fail = 0
const ok = (cond, label, detail) => {
  if (cond) {
    pass++
    console.log(`   ✓ ${label}`)
  } else {
    fail++
    console.log(`   ✗ FAIL: ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`)
  }
}
const step = (n, title) => console.log(`\n── ${n}. ${title} ─────────────────────────────`)
async function call(method, path, body) {
  // Only set Content-Type when there's a body — a JSON content-type with an empty
  // body makes Fastify reject (FST_ERR_CTP_EMPTY_JSON_BODY), e.g. the bodyless save POST.
  const headers = body !== undefined ? { ...AUTH, 'Content-Type': 'application/json' } : AUTH
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  console.log(`   → ${method} ${path} [${res.status}]`)
  return { status: res.status, json }
}
const fmtTime = (ms) => new Date(ms).toLocaleTimeString()

// ── run ──────────────────────────────────────────────────────────────────────
console.log('C4 clip-editor smoke test → ' + BASE)

// 0. Find a playable buffer session with enough footage for a clip.
step(0, 'GET /buffer/me — find a playable session')
const buf = await call('GET', '/buffer/me')
if (buf.status === 401) {
  console.error('\n401 Unauthorized — the token is missing/expired. Grab a fresh one and re-run.')
  process.exit(1)
}
const sessions = buf.json?.sessions ?? []
console.log(`   buffer: ${sessions.length} session(s), window ${buf.json?.windowHours}h`)
const sess = sessions.find((s) => s.playableKind && (s.mediaDurationSec ?? 0) > 12)
if (!sess) {
  console.error(
    '\nNo playable session with >12s of footage. Go live + let it buffer ~20s (camera on), then re-run.',
  )
  process.exit(1)
}
const mediaStart = Date.parse(sess.startedAt) + (sess.mediaStartOffsetMs ?? 0)
const mediaEnd = mediaStart + (sess.mediaDurationSec ?? 0) * 1000
const A = mediaStart + 3000 // 3s into the footage
const B = Math.min(A + 6000, mediaEnd - 1000) // ~6s window, clamped inside the footage
console.log(`   using session ${sess.id} — clip window ${fmtTime(A)}–${fmtTime(B)} (${Math.round((B - A) / 1000)}s)`)
ok(B - A >= 3000, 'have a >=3s window inside the footage', { A, B })

// 1. Create a DRAFT (no copy, no quota).
step(1, 'POST /buffer/me/clips/draft — create a draft')
const draftRes = await call('POST', '/buffer/me/clips/draft', { startAtMs: A, endAtMs: B, name: 'c4 smoke' })
ok(draftRes.status === 200 || draftRes.status === 201, 'draft created', draftRes.json)
const clipId = draftRes.json?.clip?.id
ok(!!clipId, 'returned a clip id', draftRes.json)
if (!clipId) process.exit(1)
console.log(`   draft id: ${clipId}`)

// 2. It shows in the DRAFT lane (and not the saved lane), as saved:false, with a playable URL.
step(2, 'GET /buffer/me/clips?lane=draft — verify draft shape')
const draftList = await call('GET', '/buffer/me/clips?lane=draft')
const draft = (draftList.json?.clips ?? []).find((c) => c.id === clipId)
ok(!!draft, 'draft appears in lane=draft', draftList.json)
ok(draft?.saved === false, 'saved === false (it is a draft)', draft?.saved)
ok(!!draft?.manifestUrl, 'has a manifestUrl (plays from buffer)', draft?.manifestUrl)
ok(Array.isArray(draft?.ranges) && draft.ranges.length >= 1, 'has >=1 range', draft?.ranges)
console.log(`   sources: ${JSON.stringify(draft?.sources)}  kinds: ${JSON.stringify(draft?.kinds)}`)
const savedListBefore = await call('GET', '/buffer/me/clips?lane=saved')
ok(!(savedListBefore.json?.clips ?? []).some((c) => c.id === clipId), 'draft does NOT show in lane=saved yet')

// 3. The draft's HLS actually serves (200 = stitched from the buffer).
step(3, 'GET draft manifestUrl — plays from the buffer')
if (draft?.manifestUrl) {
  const m = await fetch(draft.manifestUrl)
  console.log(`   → GET <draft manifest> [${m.status}]`)
  ok(m.status === 200, 'draft HLS serves (200)', m.status)
}

// 4. PATCH the manifest — title + turn a source off.
step(4, 'PATCH /buffer/me/clips/:id — edit manifest (title + camera off)')
const patch = await call('PATCH', `/buffer/me/clips/${clipId}`, { title: 'c4 edited', sources: { camera: false } })
ok(patch.status === 200, 'PATCH ok', patch.json)
const afterEdit = ((await call('GET', '/buffer/me/clips?lane=draft')).json?.clips ?? []).find((c) => c.id === clipId)
ok(afterEdit?.name === 'c4 edited', 'title updated', afterEdit?.name)
ok(afterEdit?.sources?.camera === false, 'sources.camera === false', afterEdit?.sources)
ok(!(afterEdit?.kinds ?? []).includes('camera'), 'kinds no longer includes camera (enabled-only)', afterEdit?.kinds)

// 5. PATCH ranges — a trim narrows the outer bounds.
step(5, 'PATCH ranges — trim narrower, bounds recompute')
const tA = A + 1500
const tB = B - 1500
const trim = await call('PATCH', `/buffer/me/clips/${clipId}`, {
  ranges: [{ bufferSessionId: sess.id, startAtMs: tA, endAtMs: tB }],
})
ok(trim.status === 200, 'trim PATCH ok', trim.json)
const afterTrim = ((await call('GET', '/buffer/me/clips?lane=draft')).json?.clips ?? []).find((c) => c.id === clipId)
ok(Math.abs((afterTrim?.startAtMs ?? 0) - tA) < 50, 'outer startAtMs == trimmed start', afterTrim?.startAtMs)
ok(Math.abs((afterTrim?.endAtMs ?? 0) - tB) < 50, 'outer endAtMs == trimmed end', afterTrim?.endAtMs)

// 6. Save = materialise the draft to durable storage.
step(6, 'POST /buffer/me/clips/:id/save — promote draft → saved')
const save = await call('POST', `/buffer/me/clips/${clipId}/save`) // NO body (Fastify rejects empty JSON body)
ok(save.status === 200 || save.status === 201, 'save ok', save.json)

// 7. It moves to the saved lane with a DURABLE url.
step(7, 'GET /buffer/me/clips?lane=saved — verify it materialised')
const savedList = await call('GET', '/buffer/me/clips?lane=saved')
const saved = (savedList.json?.clips ?? []).find((c) => c.id === clipId)
ok(!!saved, 'now appears in lane=saved', savedList.json?.clips?.map((c) => c.id))
ok(saved?.saved === true, 'saved === true', saved?.saved)
ok(typeof saved?.manifestUrl === 'string' && saved.manifestUrl.includes('/media/clips/'), 'manifestUrl is durable (/media/clips/)', saved?.manifestUrl)
const draftListAfter = await call('GET', '/buffer/me/clips?lane=draft')
ok(!(draftListAfter.json?.clips ?? []).some((c) => c.id === clipId), 'gone from lane=draft (one lane only)')
if (saved?.manifestUrl) {
  const m2 = await fetch(saved.manifestUrl)
  console.log(`   → GET <saved manifest> [${m2.status}]`)
  ok(m2.status === 200, 'saved HLS serves (200)', m2.status)
}

// 8. Editing a SAVED clip is C4.4 (in progress). Only a 500 is a real failure;
//    4xx = C4.4 still pending (expected), 2xx = C4.4 has shipped (bonus).
step(8, 'PATCH a saved clip — should be handled cleanly (no 500)')
const savedPatch = await call('PATCH', `/buffer/me/clips/${clipId}`, { title: 'x' })
ok(savedPatch.status !== 500, 'saved-clip edit handled cleanly (no 500)', savedPatch.status)
console.log(
  `   note: ${savedPatch.status >= 400 && savedPatch.status < 500 ? '4xx → C4.4 (edit saved clip) still pending — expected' : savedPatch.status < 300 ? '2xx → C4.4 has shipped!' : `status ${savedPatch.status}`}`,
)

// 9. Cleanup — delete the throwaway clip.
step(9, 'DELETE /buffer/me/clips/:id — cleanup')
const del = await call('DELETE', `/buffer/me/clips/${clipId}`)
ok(del.status === 200, 'deleted', del.json)

// ── report ─────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════`)
console.log(`  C4 smoke: ${pass} passed, ${fail} failed`)
console.log(`════════════════════════════════════════════`)
process.exit(fail ? 1 : 0)
