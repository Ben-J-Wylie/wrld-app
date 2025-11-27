// src/components/containers/SceneCore/Controllers/ScrollController.ts
// -----------------------------------------------------------------------------
// ScrollController — WRLD Scroll Physics (v2025)
// -----------------------------------------------------------------------------
// - Touch drag (stick-to-finger)
// - Wheel / trackpad scroll
// - Arrow keys (tap + smooth hold)
// - Inertia with friction
// - Works with new CameraRig (setOffset/getOffset/getLimits)
// -----------------------------------------------------------------------------

export interface ScrollControllerOptions {
  cameraRig: {
    setOffset: (x: number, y: number) => void;
    getLimits: () => { maxX: number; maxY: number };
    getOffset: () => { x: number; y: number };
  };
}

// Device detection
const IS_MOBILE =
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// =============================================================================
// CONFIG
// =============================================================================

const TOUCH_SPEED = 0.75;
const WHEEL_SPEED = 0.75;

const KEY_STEP = 50;
const KEY_HOLD_SPEED = 320;
const KEY_HOLD_DELAY = 250;

const INERTIA_GAIN = 1;
const FRICTION = 0.9;
const STOP_THRESHOLD = 0.002;

const MOBILE_MULT = IS_MOBILE ? 1 : 1;

// =============================================================================
// MAIN FACTORY
// =============================================================================

export function createScrollController({ cameraRig }: ScrollControllerOptions) {
  // normalized scroll in [0,1]
  let nx = 0.5;
  let ny = 0.5;

  // velocities (pixels/sec)
  let vx = 0;
  let vy = 0;

  let isPointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;

  let inertia = false;
  let firstSync = true;

  let keyHoldX = 0;
  let keyHoldY = 0;
  let keyHoldStart = 0;
  let keyActiveX = false;
  let keyActiveY = false;

  let dom: HTMLElement | null = null;
  let listening = false;

  // ---------------------------------------------------------------------------
  // EASY HELPERS
  // ---------------------------------------------------------------------------
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  function syncFromCameraOnce() {
    if (!firstSync) return;

    const { maxX, maxY } = cameraRig.getLimits();
    if (maxX === 0 && maxY === 0) return;

    const { x, y } = cameraRig.getOffset();

    // Convert camera offset → normalized
    nx = maxX > 0 ? x / (2 * maxX) + 0.5 : 0.5;
    ny = maxY > 0 ? -y / (2 * maxY) + 0.5 : 0.5;

    nx = clamp01(nx);
    ny = clamp01(ny);

    firstSync = false;
  }

  function applyToCamera() {
    const { maxX, maxY } = cameraRig.getLimits();

    const offX = (nx - 0.5) * 2 * maxX;
    const offY = -(ny - 0.5) * 2 * maxY;

    cameraRig.setOffset(offX, offY);
  }

  // =============================================================================
  // INPUT HANDLERS
  // =============================================================================

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const { maxX, maxY } = cameraRig.getLimits();

    if (maxX === 0 && maxY === 0) return;

    nx += (e.deltaX * WHEEL_SPEED) / Math.max(maxX, 1);
    ny += (e.deltaY * WHEEL_SPEED) / Math.max(maxY, 1);

    nx = clamp01(nx);
    ny = clamp01(ny);

    inertia = false;
    vx = vy = 0;
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const t = e.touches[0];
    isPointerDown = true;

    lastX = t.clientX;
    lastY = t.clientY;
    lastTime = e.timeStamp;

    inertia = false;
    vx = vy = 0;
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!isPointerDown) return;

    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    const dx = lastX - x;
    const dy = lastY - y;

    const dt = Math.max((e.timeStamp - lastTime) / 1000, 1 / 60);

    lastX = x;
    lastY = y;
    lastTime = e.timeStamp;

    const { maxX, maxY } = cameraRig.getLimits();
    if (maxX === 0 && maxY === 0) return;

    const drag = TOUCH_SPEED * MOBILE_MULT;

    nx += (dx * drag) / Math.max(maxX, 1);
    ny += (dy * drag) / Math.max(maxY, 1);

    nx = clamp01(nx);
    ny = clamp01(ny);

    vx = dx / dt;
    vy = dy / dt;
  }

  function onTouchEnd() {
    if (!isPointerDown) return;
    isPointerDown = false;

    const speedSq = vx * vx + vy * vy;
    inertia = speedSq > 1;
  }

  function onKeyDown(e: KeyboardEvent) {
    const now = performance.now();
    const { maxX, maxY } = cameraRig.getLimits();

    if (maxX === 0 && maxY === 0) return;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        if (!e.repeat) {
          ny -= KEY_STEP / Math.max(maxY, 1);
          keyHoldStart = now;
        } else if (now - keyHoldStart > KEY_HOLD_DELAY) {
          keyActiveY = true;
          keyHoldY = -KEY_HOLD_SPEED / Math.max(maxY, 1);
        }
        break;

      case "ArrowDown":
      case "s":
      case "S":
        if (!e.repeat) {
          ny += KEY_STEP / Math.max(maxY, 1);
          keyHoldStart = now;
        } else if (now - keyHoldStart > KEY_HOLD_DELAY) {
          keyActiveY = true;
          keyHoldY = +KEY_HOLD_SPEED / Math.max(maxY, 1);
        }
        break;

      case "ArrowLeft":
      case "a":
      case "A":
        if (!e.repeat) {
          nx -= KEY_STEP / Math.max(maxX, 1);
          keyHoldStart = now;
        } else if (now - keyHoldStart > KEY_HOLD_DELAY) {
          keyActiveX = true;
          keyHoldX = -KEY_HOLD_SPEED / Math.max(maxX, 1);
        }
        break;

      case "ArrowRight":
      case "d":
      case "D":
        if (!e.repeat) {
          nx += KEY_STEP / Math.max(maxX, 1);
          keyHoldStart = now;
        } else if (now - keyHoldStart > KEY_HOLD_DELAY) {
          keyActiveX = true;
          keyHoldX = +KEY_HOLD_SPEED / Math.max(maxX, 1);
        }
        break;

      default:
        return;
    }

    nx = clamp01(nx);
    ny = clamp01(ny);

    inertia = false;
    vx = vy = 0;
  }

  function onKeyUp() {
    keyActiveX = false;
    keyActiveY = false;
    keyHoldX = 0;
    keyHoldY = 0;
  }

  // =============================================================================
  // ANIMATION LOOP
  // =============================================================================

  function update(dt: number) {
    const { maxX, maxY } = cameraRig.getLimits();

    // Wait for CameraRig to compute limits + initial placement
    syncFromCameraOnce();

    if (maxX === 0 && maxY === 0) return;

    // KEY-HOLD MOTION
    if (keyActiveX) nx = clamp01(nx + keyHoldX * dt);
    if (keyActiveY) ny = clamp01(ny + keyHoldY * dt);

    // INERTIA MOTION
    if (inertia && !isPointerDown) {
      const gain = INERTIA_GAIN * MOBILE_MULT;

      nx += (vx * gain * dt) / Math.max(maxX, 1);
      ny += (vy * gain * dt) / Math.max(maxY, 1);

      nx = clamp01(nx);
      ny = clamp01(ny);

      const decay = Math.pow(FRICTION, dt * 60);
      vx *= decay;
      vy *= decay;

      if (Math.abs(vx) < STOP_THRESHOLD && Math.abs(vy) < STOP_THRESHOLD) {
        inertia = false;
        vx = vy = 0;
      }
    }

    applyToCamera();
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================

  return {
    start(domElement: HTMLElement) {
      if (listening) return;
      listening = true;

      dom = domElement;

      dom.addEventListener("wheel", onWheel, { passive: false });
      dom.addEventListener("touchstart", onTouchStart, { passive: false });
      dom.addEventListener("touchmove", onTouchMove, { passive: false });
      dom.addEventListener("touchend", onTouchEnd);
      dom.addEventListener("touchcancel", onTouchEnd);

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
    },

    stop() {
      if (!listening) return;
      listening = false;

      if (dom) {
        dom.removeEventListener("wheel", onWheel);
        dom.removeEventListener("touchstart", onTouchStart);
        dom.removeEventListener("touchmove", onTouchMove);
        dom.removeEventListener("touchend", onTouchEnd);
        dom.removeEventListener("touchcancel", onTouchEnd);
        dom = null;
      }

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },

    update,
  };
}
