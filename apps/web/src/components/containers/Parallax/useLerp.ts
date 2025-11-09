// src/parallax/useLerp.ts
import { useRef } from "react";

export function useLerped(start = 0) {
  const v = useRef(start);
  // returns [getter,setter(step)]
  return [
    () => v.current,
    (target: number, damping = 0.1) => {
      v.current += (target - v.current) * Math.min(1, Math.max(0.01, damping));
      return v.current;
    },
  ] as const;
}
