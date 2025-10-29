import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";

// Each registered item in the parallax scene
export type SceneItem = {
  id: string;
  depth: number;
  element: HTMLElement;
  rect: DOMRect;
};

// Context type
type ParallaxCtx = {
  scrollY: number;
  vw: number;
  vh: number;
  items: SceneItem[];
  registerItem: (item: Omit<SceneItem, "rect">) => void;
  unregisterItem: (id: string) => void;
  updateItemRect: (id: string, rect: DOMRect) => void;
};

// Default context (empty)
const Ctx = createContext<ParallaxCtx>({
  scrollY: 0,
  vw: 0,
  vh: 0,
  items: [],
  registerItem: () => {},
  unregisterItem: () => {},
  updateItemRect: () => {},
});

/**
 * Provides global viewport + registry state to all parallax items.
 * Tracks scroll position, viewport size, and every registered item's bounding rect.
 */
export const ParallaxScene: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState({
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    vw: typeof window !== "undefined" ? window.innerWidth : 0,
    vh: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  // Registry of all parallax items
  const itemsRef = useRef<Map<string, SceneItem>>(new Map());

  // Register a new item
  const registerItem = useCallback((item: Omit<SceneItem, "rect">) => {
    if (!item.element) return;
    const rect = item.element.getBoundingClientRect();
    itemsRef.current.set(item.id, { ...item, rect });
  }, []);

  // Unregister an item
  const unregisterItem = useCallback((id: string) => {
    itemsRef.current.delete(id);
  }, []);

  // Update an item’s bounding rect
  const updateItemRect = useCallback((id: string, rect: DOMRect) => {
    const existing = itemsRef.current.get(id);
    if (existing) {
      itemsRef.current.set(id, { ...existing, rect });
    }
  }, []);

  // Track scroll/resize
  useEffect(() => {
    let raf: number | null = null;

    const update = () => {
      raf = null;
      setState({
        scrollY: window.scrollY,
        vw: window.innerWidth,
        vh: window.innerHeight,
      });
      // Refresh rects for all registered items
      for (const [id, item] of itemsRef.current) {
        itemsRef.current.set(id, {
          ...item,
          rect: item.element.getBoundingClientRect(),
        });
      }
    };

    const onScroll = () => !raf && (raf = requestAnimationFrame(update));
    const onResize = onScroll;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const ctxValue: ParallaxCtx = {
    ...state,
    items: Array.from(itemsRef.current.values()),
    registerItem,
    unregisterItem,
    updateItemRect,
  };

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
};

export const useParallaxScene = () => useContext(Ctx);
