import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import ShadowProjection from "./ShadowProjection";

/* -----------------------------------------
   🔹 Scene Context: Viewport + Scroll Data
----------------------------------------- */
type ParallaxCtx = { scrollY: number; vw: number; vh: number };
const SceneCtx = createContext<ParallaxCtx>({
  scrollY: 0,
  vw: 0,
  vh: 0,
});

export const useParallaxScene = () => useContext(SceneCtx);

/* -----------------------------------------
   🔹 Registry Context: Tracks Scene Items
----------------------------------------- */
type RegisteredItem = {
  id: string;
  depth: number;
  renderForShadow: () => React.ReactNode;
};

type RegistryCtxType = {
  items: RegisteredItem[];
  register: (item: RegisteredItem) => void;
  unregister: (id: string) => void;
};

const RegistryCtx = createContext<RegistryCtxType>({
  items: [],
  register: () => {},
  unregister: () => {},
});

export const useParallaxRegistry = () => useContext(RegistryCtx);

/* -----------------------------------------
   🔹 Main Scene Component
----------------------------------------- */
export const ParallaxScene: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Track scroll + viewport size
  const [scene, setScene] = useState<ParallaxCtx>({
    scrollY: window.scrollY,
    vw: window.innerWidth,
    vh: window.innerHeight,
  });

  // Track registered items
  const [items, setItems] = useState<RegisteredItem[]>([]);
  const itemsRef = useRef<RegisteredItem[]>([]);

  // Update scroll + resize
  useEffect(() => {
    let raf: number | null = null;
    const update = () => {
      raf = null;
      setScene({
        scrollY: window.scrollY,
        vw: window.innerWidth,
        vh: window.innerHeight,
      });
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

  // Register + unregister items dynamically
  const register = (item: RegisteredItem) => {
    itemsRef.current = [
      ...itemsRef.current.filter((i) => i.id !== item.id),
      item,
    ];
    setItems([...itemsRef.current]);
  };

  const unregister = (id: string) => {
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
    setItems([...itemsRef.current]);
  };

  // Sort items by depth (lowest first)
  const sorted = [...items].sort((a, b) => a.depth - b.depth);

  /* -----------------------------------------
     🔹 Render scene layers + shadows
  ----------------------------------------- */
  return (
    <SceneCtx.Provider value={scene}>
      <RegistryCtx.Provider value={{ items, register, unregister }}>
        {/* Render the user’s parallax items */}
        {children}

        {/* Auto render inter-layer shadow projections */}
        {sorted.flatMap((upper, i) =>
          sorted
            .slice(0, i) // all lower layers
            .filter((lower) => upper.depth > lower.depth && upper.depth > 0)
            .map((lower) => (
              <ShadowProjection
                key={`${upper.id}-to-${lower.id}`}
                casterDepth={upper.depth}
                receiverDepth={lower.depth}
              >
                {upper.renderForShadow()}
              </ShadowProjection>
            ))
        )}
      </RegistryCtx.Provider>
    </SceneCtx.Provider>
  );
};
