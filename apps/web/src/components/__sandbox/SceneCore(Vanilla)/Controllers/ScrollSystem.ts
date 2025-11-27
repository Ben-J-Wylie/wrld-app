import { createScrollController } from "./ScrollController";

export function applyScrollSystem(cameraRig: any, domElement: HTMLElement) {
  const scroll = createScrollController({ cameraRig });
  scroll.start(domElement);

  return {
    scroll,
    cleanup: () => scroll.stop(),
  };
}
