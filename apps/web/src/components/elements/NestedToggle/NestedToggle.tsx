// import React from "react";
// import "../../_main/main.css";
// import { useToggleNode } from "./useToggleNode";
// import { ToggleState } from "./ToggleTypes";
// import "./NestedToggle.css";

// interface NestedToggleProps {
//   id: string;
// }

// export default function NestedToggle({ id }: NestedToggleProps) {
//   const { state, label, setState, ancestors } = useToggleNode(id);

//   const handleClick = () => {
//     let newState: ToggleState;
//     switch (state) {
//       case "on":
//       case "cued":
//         newState = "off";
//         break;
//       default:
//         newState = "on";
//         break;
//     }
//     setState(newState);
//   };

//   const text = state === "on" ? "LIVE" : state === "cued" ? "CUED" : "OFF";
//   const generation = ancestors.length + 1;

//   return (
//     <div className="toggle-wrapper" onClick={handleClick}>
//       <div className={`toggle-slider ${state}`}>
//         <div className="toggle-trough">
//           <div className="toggle-thumb">
//             <span className="toggle-text">{text}</span>
//           </div>
//         </div>
//       </div>

//       <div className="toggle-circles">
//         {[...ancestors, state].slice(-generation).map((s, i) => (
//           <div
//             key={i}
//             className={`circle circle-${s} ${
//               i === generation - 1 ? "self" : "ancestor"
//             }`}
//           />
//         ))}
//       </div>
//     </div>
//   );
// }

import React, { useState } from "react";
import "../../_main/main.css";
import { useToggleNode } from "./useToggleNode";
import { ToggleState } from "./ToggleTypes";
import "./NestedToggle.css";

interface NestedToggleProps {
  id: string;
  size?: number; // overall scale multiplier
  troughDepth?: number; // parallax depth for trough
  thumbDepth?: number; // parallax depth for thumb
  textDepth?: number; // parallax depth for text
  circleDepth?: number; // parallax depth for circles
  hoverDepthShift?: number; // depth shift on hover
  showText?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function NestedToggle({
  id,
  size = 1,
  troughDepth = 0.02,
  thumbDepth = 0.05,
  textDepth = 0.08,
  circleDepth = 0.03,
  hoverDepthShift = 0.015,
  showText = true,
  style,
  onClick,
}: NestedToggleProps) {
  const { state, label, setState, ancestors } = useToggleNode(id);
  const [hover, setHover] = useState(false);

  const handleClick = () => {
    let newState: ToggleState;
    switch (state) {
      case "on":
      case "cued":
        newState = "off";
        break;
      default:
        newState = "on";
        break;
    }
    setState(newState);
    onClick?.();
  };

  const text = state === "on" ? "LIVE" : state === "cued" ? "CUED" : "OFF";
  const generation = ancestors.length + 1;
  const depthShift = hover ? hoverDepthShift : 0;

  return (
    <div
      className="toggle-wrapper"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ transform: `scale(${size})`, ...style }}
    >
      <div className={`toggle-slider ${state}`}>
        <div className="toggle-trough" data-shadow-shape="true">
          <div className="toggle-thumb">
            {showText && <span className="toggle-text">{text}</span>}
          </div>
        </div>
      </div>

      <div className="toggle-circles" data-shadow-shape="true">
        {[...ancestors, state].slice(-generation).map((s, i) => (
          <div
            key={i}
            className={`circle circle-${s} ${
              i === generation - 1 ? "self" : "ancestor"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
