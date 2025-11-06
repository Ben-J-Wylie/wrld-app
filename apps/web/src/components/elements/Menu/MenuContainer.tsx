// import React, { useEffect, useState } from "react";
// import ParallaxItem from "../../containers/Parallax/ParallaxItem";
// import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
// import "./MenuContainer.css";

// interface MenuProps {
//   isOpen: boolean;
//   side?: "menu-left" | "menu-right" | "menu-top" | "menu-bottom";
//   onClose?: () => void;
//   depth?: number;
//   span?: number | string;
//   offset?: number | string;
//   encroach?: number | string;
//   startOffset?: number | string;
//   children: React.ReactNode;
// }

// export default function MenuContainer({
//   isOpen,
//   side = "menu-right",
//   onClose,
//   depth = 0,
//   span = "100%",
//   offset = "0%",
//   encroach = "25%",
//   startOffset = 0,
//   children,
// }: MenuProps) {
//   const { scale, width, height } = useResponsiveContext();
//   const [visible, setVisible] = useState(isOpen);

//   // ensure visibility persists long enough for animation
//   useEffect(() => {
//     if (isOpen) setVisible(true);
//     else {
//       const timer = setTimeout(() => setVisible(false), 400); // match CSS duration
//       return () => clearTimeout(timer);
//     }
//   }, [isOpen]);

//   if (!width || !height) return null;

//   const baseStyle: React.CSSProperties = {
//     position: "fixed",
//     zIndex: 90,
//     overflow: "hidden",
//     display: "flex",
//     justifyContent: "center",
//     alignItems: "center",
//   };

//   const getViewportOffset = (axis: "X" | "Y") => {
//     const dimension = axis === "X" ? width : height;

//     if (typeof offset === "string" && offset.includes("%")) {
//       const numeric = parseFloat(offset);
//       return (numeric / 100) * dimension; // convert % of viewport dimension to px
//     }

//     // Fallback if offset is numeric (already pixels)
//     return Number(offset) || 0;
//   };

//   let layoutStyle: React.CSSProperties = {};

//   switch (side) {
//     case "menu-left":
//     case "menu-right": {
//       const horizontalPosition =
//         side === "menu-left" ? { left: 0 } : { right: 0 };
//       layoutStyle = {
//         ...baseStyle,
//         ...horizontalPosition,
//         top: "50%",
//         height: span,
//         width: encroach,
//         transform: `translateY(-50%) translateY(${getViewportOffset("Y")}px)`,
//       };
//       break;
//     }

//     case "menu-top": {
//       layoutStyle = {
//         ...baseStyle,
//         top: startOffset ?? 0,
//         left: "50%",
//         width: span,
//         height: encroach,
//         transform: `translateX(-50%) translateX(${getViewportOffset("X")}px)`,
//       };
//       break;
//     }

//     case "menu-bottom": {
//       layoutStyle = {
//         ...baseStyle,
//         bottom: startOffset ?? 0,
//         left: "50%",
//         width: span,
//         height: encroach,
//         transform: `translateX(-50%) translateX(${getViewportOffset("X")}px)`,
//       };
//       break;
//     }
//   }

//   return (
//     visible && (
//       <ParallaxItem depth={depth} fixed style={layoutStyle}>
//         <div
//           ref={(el) => {
//             if (el && isOpen) {
//               // Force reflow so transition triggers correctly
//               requestAnimationFrame(() => {
//                 el.classList.add("open");
//                 el.classList.remove("closed");
//               });
//             } else if (el && !isOpen) {
//               el.classList.add("closed");
//               el.classList.remove("open");
//             }
//           }}
//           className={`menu-container ${side} ${isOpen ? "closed" : ""}`}
//           style={{
//             borderRadius: `${12 * scale}px`,
//           }}
//         >
//           {children}
//         </div>
//       </ParallaxItem>
//     )
//   );
// }

// FIX TO MENU ENTRY REPOSITIIONING.

import React, { useEffect, useState } from "react";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import "./MenuContainer.css";

interface MenuProps {
  isOpen: boolean;
  side?: "menu-left" | "menu-right" | "menu-top" | "menu-bottom";
  onClose?: () => void;
  depth?: number;
  span?: number | string;
  offset?: number | string;
  encroach?: number | string;
  startOffset?: number | string;
  children: React.ReactNode;
}

export default function MenuContainer({
  isOpen,
  side = "menu-right",
  onClose,
  depth = 0,
  span = "100%",
  offset = "0%",
  encroach = "25%",
  startOffset = 0,
  children,
}: MenuProps) {
  const { scale, width, height } = useResponsiveContext();
  const [visible, setVisible] = useState(isOpen);

  // ensure visibility persists long enough for animation
  useEffect(() => {
    if (isOpen) setVisible(true);
    else {
      const timer = setTimeout(() => setVisible(false), 400); // match CSS duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!width || !height) return null;

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 90,
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const getViewportOffset = (axis: "X" | "Y") => {
    const dimension = axis === "X" ? width : height;

    if (typeof offset === "string" && offset.includes("%")) {
      const numeric = parseFloat(offset);
      return (numeric / 100) * dimension; // convert % of viewport dimension to px
    }

    // Fallback if offset is numeric (already pixels)
    return Number(offset) || 0;
  };

  let layoutStyle: React.CSSProperties = {};

  switch (side) {
    case "menu-left":
    case "menu-right": {
      const horizontalPosition =
        side === "menu-left" ? { left: 0 } : { right: 0 };
      layoutStyle = {
        ...baseStyle,
        ...horizontalPosition,
        top: "50%",
        height: span,
        width: encroach,
        transform: `translateY(-50%) translateY(${getViewportOffset("Y")}px)`,
      };
      break;
    }

    case "menu-top": {
      layoutStyle = {
        ...baseStyle,
        top: startOffset ?? 0,
        left: "50%",
        width: span,
        height: encroach,
        transform: `translateX(-50%) translateX(${getViewportOffset("X")}px)`,
      };
      break;
    }

    case "menu-bottom": {
      layoutStyle = {
        ...baseStyle,
        bottom: startOffset ?? 0,
        left: "50%",
        width: span,
        height: encroach,
        transform: `translateX(-50%) translateX(${getViewportOffset("X")}px)`,
      };
      break;
    }
  }

  return (
    visible && (
      <ParallaxItem depth={depth} fixed style={layoutStyle}>
        <div
          ref={(el) => {
            if (el && isOpen) {
              requestAnimationFrame(() => {
                el.classList.add("open");
                el.classList.remove("closed");

                // 🔹 Trigger menuReflow after transition completes
                setTimeout(() => {
                  window.dispatchEvent(new Event("menuReflow"));
                }, 400); // match your CSS transition duration
              });
            } else if (el && !isOpen) {
              el.classList.add("closed");
              el.classList.remove("open");
            }
          }}
          className={`menu-container ${side} ${isOpen ? "closed" : ""}`}
          style={{
            borderRadius: `${12 * scale}px`,
          }}
        >
          {children}
        </div>
      </ParallaxItem>
    )
  );
}

// NO SNAP AT THE END OF ANIMATION
