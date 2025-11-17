// ScrollController.ts — WRLD DOM-Like Scroll Physics
// --------------------------------------------------
// - Touch drag (stick-to-finger, 1:1 feel)
// - Flick inertia with friction
// - Wheel / trackpad scroll
// - Arrow keys: tap + smooth hold
// - Works identically regardless of world/backdrop size
// - Mobile boost for touch responsiveness
// - Normalized scroll range (0–1), mapped to CameraRig limits

// --------------------------------------------------
// TYPE
// --------------------------------------------------
export interface ScrollControllerOptions {
  cameraRig: {
    setOffset: (x: number, y: number) => void;
    getLimits: () => { maxX: number; maxY: number };
    onResizeOrFovChange?: () => void;
  };
}

// --------------------------------------------------
// DEVICE DETECTION
// --------------------------------------------------
const IS_MOBILE =
  typeof window !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// --------------------------------------------------
// CONFIG (Desktop-first — mobile multipliers below)
// --------------------------------------------------
const TOUCH_DRAG_SPEED = 0.05;
const WHEEL_SPEED = 0.05;
const KEY_STEP = 0.5;
const KEY_HOLD_VELOCITY = 50;
const KEY_HOLD_DELAY = 270;
const INERTIA_GAIN = 0.01;
const FRICTION = 0.9;
const STOP_THRESHOLD = 0.0001;

// Mobile-only tuning (boosts raw input deltas)
const MOBILE_TOUCH_MULTIPLIER = IS_MOBILE ? 1.5 : 1;
const MOBILE_INERTIA_MULTIPLIER = IS_MOBILE ? 10 : 1;

// --------------------------------------------------
// STATE (Normalized Scrolling: scrollX/scrollY = 0–1)
// --------------------------------------------------
let scrollX = 0.5;
let scrollY = 0.5;

let velocityX = 0;
let velocityY = 0;

let isKeyScrollingX = false;
let isKeyScrollingY = false;
let keyVelocityX = 0;
let keyVelocityY = 0;
let keyDownTime = 0;

let isPointerDown = false;
let lastTouchX = 0;
let lastTouchY = 0;
let lastTouchTime = 0;

let inertiaActive = false;
let isListening = false;
let dom: HTMLElement | null = null;

// --------------------------------------------------
// MAIN CONTROLLER FACTORY
// --------------------------------------------------
export function createScrollController({ cameraRig }: ScrollControllerOptions) {
  // --------------------------------------------------
  // MAP NORMALIZED SCROLL → CAMERA OFFSET
  // --------------------------------------------------
  function applyCameraOffset() {
    const { maxX, maxY } = cameraRig.getLimits();

    // clamp normalized scroll
    const nx = Math.min(1, Math.max(0, scrollX));
    const ny = Math.min(1, Math.max(0, scrollY));

    // horizontal (natural)
    const offX = (nx - 0.5) * 2 * maxX;

    // vertical (inverted)
    const offY = -(ny - 0.5) * 2 * maxY;

    cameraRig.setOffset(offX, offY);
  }

  // --------------------------------------------------
  // INPUT HANDLERS
  // --------------------------------------------------

  // Wheel / Trackpad
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();

    const { maxX, maxY } = cameraRig.getLimits();

    scrollY += (e.deltaY * WHEEL_SPEED) / Math.max(maxY, 1);
    scrollX += (e.deltaX * WHEEL_SPEED) / Math.max(maxX, 1);

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;
  }

  // Touch begin
  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (!e.touches.length) return;

    const t = e.touches[0];
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    lastTouchTime = e.timeStamp;

    isPointerDown = true;
    inertiaActive = false;

    velocityX = 0;
    velocityY = 0;
  }

  // Touch move (DOM-like drag)
  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!isPointerDown || !e.touches.length) return;

    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    const dx = lastTouchX - x;
    const dy = lastTouchY - y;

    const now = e.timeStamp;
    let dt = (now - lastTouchTime) / 1000;
    if (dt <= 0) dt = 1 / 60;

    lastTouchX = x;
    lastTouchY = y;
    lastTouchTime = now;

    const { maxX, maxY } = cameraRig.getLimits();

    const dragBoost = TOUCH_DRAG_SPEED * MOBILE_TOUCH_MULTIPLIER;

    // convert drag → normalized scroll
    scrollX += (dx * dragBoost) / Math.max(maxX, 1);
    scrollY += (dy * dragBoost) / Math.max(maxY, 1);

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    // track flick velocity (px/sec)
    velocityX = dx / dt;
    velocityY = dy / dt;
  }

  // Touch end (start inertia if flick was fast)
  function onTouchEnd() {
    if (!isPointerDown) return;
    isPointerDown = false;

    const speedSq = velocityX * velocityX + velocityY * velocityY;
    inertiaActive = speedSq > 0.01;
  }

  // Keyboard — tap and hold
  function onKeyDown(e: KeyboardEvent) {
    const now = performance.now();
    const repeat = e.repeat;

    const { maxX, maxY } = cameraRig.getLimits();

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        if (!repeat) {
          scrollY -= KEY_STEP / Math.max(maxY, 1);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = -KEY_HOLD_VELOCITY / Math.max(maxY, 1);
        }
        break;

      case "ArrowDown":
      case "s":
      case "S":
        if (!repeat) {
          scrollY += KEY_STEP / Math.max(maxY, 1);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = +KEY_HOLD_VELOCITY / Math.max(maxY, 1);
        }
        break;

      case "ArrowLeft":
      case "a":
      case "A":
        if (!repeat) {
          scrollX -= KEY_STEP / Math.max(maxX, 1);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = -KEY_HOLD_VELOCITY / Math.max(maxX, 1);
        }
        break;

      case "ArrowRight":
      case "d":
      case "D":
        if (!repeat) {
          scrollX += KEY_STEP / Math.max(maxX, 1);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = +KEY_HOLD_VELOCITY / Math.max(maxX, 1);
        }
        break;

      // Pagination
      case "Home":
        scrollY = 0;
        break;
      case "End":
        scrollY = 1;
        break;
      case "PageUp":
        scrollY = Math.max(0, scrollY - 0.3);
        break;
      case "PageDown":
        scrollY = Math.min(1, scrollY + 0.3);
        break;

      default:
        return;
    }

    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;

    e.preventDefault();
  }

  function onKeyUp() {
    isKeyScrollingX = false;
    isKeyScrollingY = false;
    keyVelocityX = 0;
    keyVelocityY = 0;
  }

  // --------------------------------------------------
  // ANIMATION LOOP
  // --------------------------------------------------
  function animate(dt: number) {
    const { maxX, maxY } = cameraRig.getLimits();

    // 1. Inertia (flick momentum)
    if (inertiaActive && !isPointerDown) {
      const inertiaBoost = INERTIA_GAIN * MOBILE_INERTIA_MULTIPLIER;

      scrollX += (velocityX * inertiaBoost * dt) / Math.max(maxX, 1);
      scrollY += (velocityY * inertiaBoost * dt) / Math.max(maxY, 1);

      scrollX = Math.min(1, Math.max(0, scrollX));
      scrollY = Math.min(1, Math.max(0, scrollY));

      const decay = Math.pow(FRICTION, dt * 60);
      velocityX *= decay;
      velocityY *= decay;

      if (
        Math.abs(velocityX) < STOP_THRESHOLD &&
        Math.abs(velocityY) < STOP_THRESHOLD
      ) {
        inertiaActive = false;
        velocityX = 0;
        velocityY = 0;
      }
    }

    // 2. Arrow key smooth scroll
    if (isKeyScrollingX) {
      scrollX += keyVelocityX * dt;
      scrollX = Math.min(1, Math.max(0, scrollX));
    }

    if (isKeyScrollingY) {
      scrollY += keyVelocityY * dt;
      scrollY = Math.min(1, Math.max(0, scrollY));
    }

    // 3. Apply offset
    applyCameraOffset();
  }

  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------
  return {
    start(domElement: HTMLElement) {
      if (isListening) return;
      isListening = true;

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
      if (!isListening) return;
      isListening = false;

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

    update(dt: number) {
      animate(dt);
    },
  };
}
