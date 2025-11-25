// useScrollController.ts
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createScrollController } from "../Controllers/ScrollController";

export function useScrollController(
  cameraRig: any,
  domElement: HTMLElement | null
) {
  const controllerRef = useRef<any>(null);

  useEffect(() => {
    if (!cameraRig || !domElement) return;

    controllerRef.current = createScrollController({ cameraRig });
    controllerRef.current.start(domElement);

    return () => controllerRef.current?.stop();
  }, [cameraRig, domElement]);

  useFrame((_, dt) => {
    controllerRef.current?.update(dt);
  });
}
