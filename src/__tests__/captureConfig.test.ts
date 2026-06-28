import { describe, it, expect, beforeEach } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage' // aliased to the in-memory stub
import { loadCaptureConfig, DEFAULT_CAPTURE_CONFIG } from '@/lib/captureConfig'

const KEY = '@wrld_capture_config' // mirrors the module's private key

const seed = (v: unknown) => AsyncStorage.setItem(KEY, JSON.stringify(v))

describe('captureConfig — load / migrate / merge', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
  })

  it('empty storage → defaults', async () => {
    expect(await loadCaptureConfig()).toEqual(DEFAULT_CAPTURE_CONFIG)
  })

  it('corrupt JSON → defaults (never throws)', async () => {
    await AsyncStorage.setItem(KEY, 'not-json{')
    expect(await loadCaptureConfig()).toEqual(DEFAULT_CAPTURE_CONFIG)
  })

  it('a partial `air` MERGES per-key (does not disarm the defaults)', async () => {
    await seed({ air: { screen: true } })
    const cfg = await loadCaptureConfig()
    // cam/audio/loc defaults survive + the persisted screen is added — the key bug this guards.
    expect(cfg.air).toEqual({ cam: true, audio: true, loc: true, screen: true })
  })

  it('an explicit `cam:false` is preserved (not restored to on)', async () => {
    await seed({ air: { cam: false } })
    const cfg = await loadCaptureConfig()
    expect(cfg.air).toEqual({ cam: false, audio: true, loc: true })
  })

  it("migrates the renamed precision value 'bluedot' → 'exact'", async () => {
    await seed({ precision: 'bluedot' })
    expect((await loadCaptureConfig()).precision).toBe('exact')
  })

  it('fills any scalar field a previous version did not persist', async () => {
    await seed({ title: 'hi' })
    const cfg = await loadCaptureConfig()
    expect(cfg.title).toBe('hi')
    expect(cfg.lane).toBe(DEFAULT_CAPTURE_CONFIG.lane)
    expect(cfg.precision).toBe(DEFAULT_CAPTURE_CONFIG.precision)
  })
})
