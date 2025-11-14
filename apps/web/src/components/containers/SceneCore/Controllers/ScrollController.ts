// SceneCore/engine/input/ScrollController.ts
import { SceneConfig, useSceneStore } from "../../SceneCore";

/**
 * applyScrollController
 * ---------------------------------------------------------------------------
 * Vanilla version of the R3F ScrollController.
 * Creates a unified scroll input system:
 *  - wheel
 *  - touch
 *  - keyboard
 *  - spring + damping physics
 *
 * Writes scroll (0–1) to Zustand store.
 */
export function applyScrollController() {
  const setScroll = useSceneStore.getState().setScroll;

  // Refs (imperative state)
  const position = { value: 0 }; // actual scroll
  const target = { value: 0 };   // desired scroll (wheel/touch/keyboard)
  const velocity = { value: 0 };
  const touchActive = { value: false };
  const lastTouchY = { value: 0 };
  const lastDeltaY = { value: 0 };

  // Pull scroll settings from SceneConfig
  const {
    baseWheelSpeed = 0.002,
    baseTouchSpeed = 0.002,
    baseKeySpeed = 0.05,
    damping = 0.9,
    spring = 0.08,
  } = SceneConfig.scroll as any;

  function computeScrollScale() {
    const state = useSceneStore.getState();

    const sceneHeight =
      state.sceneHeight ?? SceneConfig.scene.background.sceneHeight;

    const visibleHeight = state.visibleHeight ?? 10;

    // Prevent unusably slow scroll when visibleHeight is tiny
    return Math.max(visibleHeight / sceneHeight, 0.1);
  }

  // The scroll-scale depends on sceneHeight or visibleHeight changes
  function getSpeeds() {
    const scrollScale = computeScrollScale();
    return {
      wheelSpeed: baseWheelSpeed * scrollScale,
      touchSpeed: baseTouchSpeed * scrollScale,
      keySpeed: baseKeySpeed * scrollScale,
    };
  }

  // ---------------------------------------------------------------------------
  // WHEEL
  // ---------------------------------------------------------------------------
  function onWheel(e: WheelEvent) {
    const { wheelSpeed } = getSpeeds();
    target.value += e.deltaY * wheelSpeed;
    target.value = Math.min(1, Math.max(0, target.value));
  }

  // ---------------------------------------------------------------------------
  // TOUCH
  // ---------------------------------------------------------------------------
  function onTouchStart(e: TouchEvent) {
    e.preventDefault();
    touchActive.value = true;
    lastTouchY.value = e.touches[0].clientY;
    lastDeltaY.value = 0;
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    const { touchSpeed } = getSpeeds();

    const y = e.touches[0].clientY;
    const deltaY = lastTouchY.value - y;
    lastTouchY.value = y;
    lastDeltaY.value = deltaY;

    const instantDelta = deltaY * touchSpeed;

    position.value += instantDelta;
    position.value = Math.min(1, Math.max(0, position.value));

    // touch directly drives both position & target
    target.value = position.value;

    setScroll(position.value);
  }

  function onTouchEnd() {
    touchActive.value = false;

    const { touchSpeed } = getSpeeds();
    velocity.value = lastDeltaY.value * touchSpeed * 0.5;
  }

  // ---------------------------------------------------------------------------
  // KEYBOARD
  // ---------------------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent) {
    const { keySpeed } = getSpeeds();
    switch (e.key) {
      case "ArrowDown":
      case "s":
      case "S":
        target.value = Math.min(1, target.value + keySpeed);
        break;
      case "ArrowUp":
      case "w":
      case "W":
        target.value = Math.max(0, target.value - keySpeed);
        break;
      case "PageDown":
        target.value = 1;
        break;
      case "PageUp":
        target.value = 0;
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  // ---------------------------------------------------------------------------
  // PHYSICS LOOP
  // ---------------------------------------------------------------------------
  let anim: number;
  function loop() {
    if (!touchActive.value) {
      // spring force toward target
      velocity.value += (target.value - position.value) * spring;
      velocity.value *= damping;

      position.value += velocity.value;
      position.value = Math.min(1, Math.max(0, position.value));

      setScroll(position.value);
    }

    anim = requestAnimationFrame(loop);
  }
  anim = requestAnimationFrame(loop);

  // ---------------------------------------------------------------------------
  // ATTACH EVENTS
  // ---------------------------------------------------------------------------
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
  window.addEventListener("keydown", onKeyDown);

  // Optional cleanup return if you want:
  return () => {
    cancelAnimationFrame(anim);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    window.removeEventListener("keydown", onKeyDown);
  };
}
