// @ts-nocheck

// src/components/containers/Scene/ScrollDomWrapper.tsx
import { useRef, useEffect } from "react";
import { useSceneStore } from "@/components/containers/SceneCore";

export function ScrollDomWrapper({ children }: { children: React.ReactNode }) {
  const setScroll = useSceneStore((s) => s.setScroll);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      const normalized = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
      setScroll(normalized);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [setScroll]);

  // give it enough height to scroll through your worldHeight (in vh)
  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflowY: "scroll",
        overscrollBehavior: "none",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* The inner spacer defines scrollable height */}
      <div
        style={{
          height: "300vh", // roughly 3x viewport for testing
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}
