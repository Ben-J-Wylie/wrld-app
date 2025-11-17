// ScrollController.ts — DOM-like 2D scroll physics for WRLD
// - Touch drag (stick-to-finger)
// - Flick inertia (momentum)
// - Wheel & trackpad support
// - Arrow key tap = step, hold = smooth scroll
// - Both X and Y axes
// - Maps to CameraRig offsets

// -------------------------------------------------------
// CONFIG
// -------------------------------------------------------
const TOUCH_DRAG_SPEED = 0.0025; // page-per-px when dragging
const WHEEL_SPEED = 0.0018; // scroll per wheel delta
const KEY_STEP = 0.05; // discrete arrow key tap movement
const KEY_HOLD_VELOCITY = 0.35; // continuous scroll speed (per second)
const KEY_HOLD_DELAY = 300; // ms before smooth scrolling starts
const INERTIA_GAIN = 0.0008; // flick → normalized scroll multiplier
const FRICTION = 0.92; // inertia friction (0.9–0.97)
const STOP_THRESHOLD = 0.001; // inertia stop threshold

export interface ScrollControllerOptions {
  cameraRig: {
    setOffset: (x: number, y: number) => void;
    getLimits: () => { maxX: number; maxY: number };
    onResizeOrFovChange?: () => void;
  };
}

// -------------------------------------------------------
// INTERNAL STATE
// -------------------------------------------------------

// Normalized scroll positions (0–1)
let scrollX = 0.5;
let scrollY = 0.5;

// Velocities for inertia (px/sec converted later)
let velocityX = 0;
let velocityY = 0;

// Arrow key smooth scroll state
let isKeyScrollingX = false;
let isKeyScrollingY = false;
let keyVelocityX = 0;
let keyVelocityY = 0;
let keyDownTime = 0;

// Touch drag state
let isPointerDown = false;
let lastTouchX = 0;
let lastTouchY = 0;
let lastTouchTime = 0;

// Inertia state
let inertiaActive = false;

// Event management
let isListening = false;
let dom: HTMLElement | null = null;

// -------------------------------------------------------
// MAIN CONTROLLER
// -------------------------------------------------------
export function createScrollController({ cameraRig }: ScrollControllerOptions) {
  // -----------------------------------------------------
  // MAP NORMALIZED SCROLL → CAMERA OFFSET
  // -----------------------------------------------------
  function applyCameraOffset() {
    const { maxX, maxY } = cameraRig.getLimits();
    if (maxX === 0 && maxY === 0) return;

    const nx = Math.min(1, Math.max(0, scrollX));
    const ny = Math.min(1, Math.max(0, scrollY));

    // Horizontal → NOT inverted
    const offX = (nx - 0.5) * 2 * maxX;

    // Vertical → INVERTED (natural browser scroll feel)
    const offY = -(ny - 0.5) * 2 * maxY;

    cameraRig.setOffset(offX, offY);
  }

  // -----------------------------------------------------
  // INPUT HANDLERS
  // -----------------------------------------------------

  // Wheel / Trackpad scrolling
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();

    scrollY += e.deltaY * WHEEL_SPEED;
    scrollX += e.deltaX * WHEEL_SPEED;

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    // kill inertia
    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;
  }

  // Touch begin = cancel inertia, begin drag
  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 0) return;

    const t = e.touches[0];
    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    lastTouchTime = e.timeStamp;

    isPointerDown = true;
    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;
  }

  // Touch move = direct page drag
  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!isPointerDown || e.touches.length === 0) return;

    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    const dx = lastTouchX - x; // finger left
    const dy = lastTouchY - y; // finger up

    const now = e.timeStamp;
    let dt = (now - lastTouchTime) / 1000;
    if (dt <= 0) dt = 1 / 60;

    lastTouchX = x;
    lastTouchY = y;
    lastTouchTime = now;

    // Stick-to-finger drag
    scrollX += dx * TOUCH_DRAG_SPEED;
    scrollY += dy * TOUCH_DRAG_SPEED;

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    // track velocity for inertia
    velocityX = dx / dt;
    velocityY = dy / dt;
  }

  // Touch release → inertia starts if flick velocity > threshold
  function onTouchEnd() {
    if (!isPointerDown) return;
    isPointerDown = false;

    const speedSq = velocityX * velocityX + velocityY * velocityY;
    inertiaActive = speedSq > 0.01;
  }

  // Keyboard tap & hold → DOM-style stepping & smooth scroll
  function onKeyDown(e: KeyboardEvent) {
    const now = performance.now();
    const isRepeat = e.repeat;

    switch (e.key) {
      // --------- Vertical Up ---------
      case "ArrowUp":
      case "w":
      case "W":
        if (!isRepeat) {
          scrollY = Math.max(0, scrollY - KEY_STEP);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = -KEY_HOLD_VELOCITY;
        }
        break;

      // --------- Vertical Down ---------
      case "ArrowDown":
      case "s":
      case "S":
        if (!isRepeat) {
          scrollY = Math.min(1, scrollY + KEY_STEP);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = +KEY_HOLD_VELOCITY;
        }
        break;

      // --------- Horizontal Left ---------
      case "ArrowLeft":
      case "a":
      case "A":
        if (!isRepeat) {
          scrollX = Math.max(0, scrollX - KEY_STEP);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = -KEY_HOLD_VELOCITY;
        }
        break;

      // --------- Horizontal Right ---------
      case "ArrowRight":
      case "d":
      case "D":
        if (!isRepeat) {
          scrollX = Math.min(1, scrollX + KEY_STEP);
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = +KEY_HOLD_VELOCITY;
        }
        break;

      // --------- Pagination ---------
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

    // Cancel inertia on any key scroll
    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;

    e.preventDefault();
  }

  // Stop smooth scroll on key release
  function onKeyUp() {
    isKeyScrollingX = false;
    isKeyScrollingY = false;
    keyVelocityX = 0;
    keyVelocityY = 0;
    inertiaActive = false;
  }

  // -----------------------------------------------------
  // ANIMATION LOOP (called by engine.update(dt))
  // -----------------------------------------------------
  function animate(dt: number) {
    // 1. Inertia (flick momentum)
    if (inertiaActive && !isPointerDown) {
      scrollX += velocityX * INERTIA_GAIN * dt;
      scrollY += velocityY * INERTIA_GAIN * dt;

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

    // 2. Arrow key smooth continuous scroll
    if (isKeyScrollingX) {
      scrollX += keyVelocityX * dt;
      scrollX = Math.min(1, Math.max(0, scrollX));
    }

    if (isKeyScrollingY) {
      scrollY += keyVelocityY * dt;
      scrollY = Math.min(1, Math.max(0, scrollY));
    }

    // 3. Apply camera movement
    applyCameraOffset();
  }

  // -----------------------------------------------------
  // PUBLIC API
  // -----------------------------------------------------
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
