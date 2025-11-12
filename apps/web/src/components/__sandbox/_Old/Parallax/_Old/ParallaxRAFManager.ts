// src/containers/Parallax/ParallaxRAFManager.ts

type Subscriber = () => void;

/**
 * Global Parallax RAF Manager (Request Animation Frame)
 * - Manages a single requestAnimationFrame loop
 * - Notifies all subscribed ParallaxItems every frame
 * - Auto-pauses when the tab is hidden or frame rate is low
 */
class ParallaxRAFManager {
  private subscribers: Set<Subscriber> = new Set();
  private frameId: number | null = null;
  private running = false;

  // --- Dynamic throttling ---
  private minFrameInterval = 1000 / 30; // 30 FPS lower bound
  private lastTime = 0;

  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    if (!this.running) this.start();
    return () => this.unsubscribe(fn);
  }

  unsubscribe(fn: Subscriber) {
    this.subscribers.delete(fn);
    if (this.subscribers.size === 0) this.stop();
  }

  // --- Main loop ---
  private loop = (timestamp: number) => {
    // Throttle if frame rate is too high or tab inactive
    if (document.hidden) {
      this.stop();
      return;
    }

    const delta = timestamp - this.lastTime;
    if (delta >= this.minFrameInterval) {
      this.lastTime = timestamp;
      this.subscribers.forEach((fn) => fn());
    }

    this.frameId = requestAnimationFrame(this.loop);
  };

  private start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.loop);

    // Handle visibility changes
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  private stop() {
    if (!this.running) return;
    this.running = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }

  private handleVisibility = () => {
    if (document.hidden) this.stop();
    else if (!this.running && this.subscribers.size > 0) this.start();
  };
}

export const parallaxRAFManager = new ParallaxRAFManager();