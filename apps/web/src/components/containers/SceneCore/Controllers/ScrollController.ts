// ScrollController.ts — DOM-like 2D scroll physics for WRLD
// Ensures identical scroll feel regardless of backdrop size.

export interface ScrollControllerOptions {
  cameraRig: {
    setOffset: (x: number, y: number) => void;
    getLimits: () => { maxX: number; maxY: number };
    onResizeOrFovChange?: () => void;
  };
}

// -------------------------------------------------------
// CONFIG
// -------------------------------------------------------
const TOUCH_DRAG_SPEED = 0.05; // MUCH faster drag
const WHEEL_SPEED = 0.05; // MUCH higher wheel responsiveness

const KEY_STEP = 0.5; // 12% of page per tap (Chrome)
const KEY_HOLD_VELOCITY = 50; // 2.2 normalized units/sec (VERY fast)
const KEY_HOLD_DELAY = 270; // feels just like browser

const INERTIA_GAIN = 0.01; // flick momentum (much stronger)
const FRICTION = 0.9; // smooth deceleration
const STOP_THRESHOLD = 0.0001; // stop only at very low speeds
// -------------------------------------------------------
// INTERNAL STATE
// -------------------------------------------------------
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

// -------------------------------------------------------
// CONTROLLER
// -------------------------------------------------------
export function createScrollController({ cameraRig }: ScrollControllerOptions) {
  function applyCameraOffset() {
    const { maxX, maxY } = cameraRig.getLimits();

    const nx = Math.min(1, Math.max(0, scrollX));
    const ny = Math.min(1, Math.max(0, scrollY));

    const offX = (nx - 0.5) * 2 * maxX;
    const offY = -(ny - 0.5) * 2 * maxY;

    cameraRig.setOffset(offX, offY);
  }

  // -------------------------------------------------------
  // INPUT HANDLERS
  // -------------------------------------------------------

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();

    const { maxX, maxY } = cameraRig.getLimits();

    // ⭐ Convert wheel motion → normalized scroll independently of world size
    scrollY += (e.deltaY * WHEEL_SPEED) / Math.max(maxY, 1); // ⭐ NEW
    scrollX += (e.deltaX * WHEEL_SPEED) / Math.max(maxX, 1); // ⭐ NEW

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;
  }

  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const t = e.touches[0];

    lastTouchX = t.clientX;
    lastTouchY = t.clientY;
    lastTouchTime = e.timeStamp;

    isPointerDown = true;
    inertiaActive = false;
    velocityX = 0;
    velocityY = 0;
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!isPointerDown) return;

    const { maxX, maxY } = cameraRig.getLimits();

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

    // ⭐ Convert drag → normalized scroll, independent of stage size
    scrollX += (dx * TOUCH_DRAG_SPEED) / Math.max(maxX, 1); // ⭐ NEW
    scrollY += (dy * TOUCH_DRAG_SPEED) / Math.max(maxY, 1); // ⭐ NEW

    scrollX = Math.min(1, Math.max(0, scrollX));
    scrollY = Math.min(1, Math.max(0, scrollY));

    velocityX = dx / dt;
    velocityY = dy / dt;
  }

  function onTouchEnd() {
    if (!isPointerDown) return;
    isPointerDown = false;

    const speedSq = velocityX * velocityX + velocityY * velocityY;
    inertiaActive = speedSq > 0.01;
  }

  function onKeyDown(e: KeyboardEvent) {
    const now = performance.now();
    const repeat = e.repeat;

    const { maxX, maxY } = cameraRig.getLimits();

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        if (!repeat) {
          scrollY -= KEY_STEP / Math.max(maxY, 1); // ⭐ NEW
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = -KEY_HOLD_VELOCITY / Math.max(maxY, 1); // ⭐ NEW
        }
        break;

      case "ArrowDown":
      case "s":
      case "S":
        if (!repeat) {
          scrollY += KEY_STEP / Math.max(maxY, 1); // ⭐ NEW
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingY = true;
          keyVelocityY = +KEY_HOLD_VELOCITY / Math.max(maxY, 1); // ⭐ NEW
        }
        break;

      case "ArrowLeft":
      case "a":
      case "A":
        if (!repeat) {
          scrollX -= KEY_STEP / Math.max(maxX, 1); // ⭐ NEW
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = -KEY_HOLD_VELOCITY / Math.max(maxX, 1); // ⭐ NEW
        }
        break;

      case "ArrowRight":
      case "d":
      case "D":
        if (!repeat) {
          scrollX += KEY_STEP / Math.max(maxX, 1); // ⭐ NEW
          keyDownTime = now;
        } else if (now - keyDownTime > KEY_HOLD_DELAY) {
          isKeyScrollingX = true;
          keyVelocityX = +KEY_HOLD_VELOCITY / Math.max(maxX, 1); // ⭐ NEW
        }
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

  // -----------------------------------------------------
  // ANIMATION LOOP
  // -----------------------------------------------------
  function animate(dt: number) {
    const { maxX, maxY } = cameraRig.getLimits();

    if (inertiaActive && !isPointerDown) {
      scrollX += (velocityX * INERTIA_GAIN * dt) / Math.max(maxX, 1); // ⭐ NEW
      scrollY += (velocityY * INERTIA_GAIN * dt) / Math.max(maxY, 1); // ⭐ NEW

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

    if (isKeyScrollingX) {
      scrollX += keyVelocityX * dt;
      scrollX = Math.min(1, Math.max(0, scrollX));
    }

    if (isKeyScrollingY) {
      scrollY += keyVelocityY * dt;
      scrollY = Math.min(1, Math.max(0, scrollY));
    }

    applyCameraOffset();
  }

  // -----------------------------------------------------
  // API
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
