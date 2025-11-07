// // NestedToggle.tsx
// import React from "react";
// import "../../_main/main.css";
// import { useToggleNode } from "./useToggleNode";
// import { ToggleState } from "./ToggleTypes";

// interface NestedToggleProps {
//   id: string;
// }

// export default function NestedToggle({ id }: NestedToggleProps) {
//   const { state, label, setState, ancestors } = useToggleNode(id);

//   const handleClick = () => {
//     let newState: ToggleState;

//     switch (state) {
//       case "on":
//         newState = "off";
//         break;
//       case "cued":
//         newState = "off"; // or decide if you want to toggle to "on"
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

// // NestedToggle.tsx
// import React from "react";
// import "../../_main/main.css";
// import { useToggleNode } from "./useToggleNode";
// import { ToggleState } from "./ToggleTypes";

// interface NestedToggleProps {
//   id: string;
// }

// export default function NestedToggle({ id }: NestedToggleProps) {
//   const { state, label, setState, ancestors } = useToggleNode(id);

//   const handleClick = () => {
//     let newState: ToggleState;
//     switch (state) {
//       case "on":
//         newState = "off";
//         break;
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
//           {/* Primary thumb */}
//           <div className="toggle-thumb">
//             <span className="toggle-text">{text}</span>
//             {/* ✅ Duplicate thumb stroke */}
//             <div
//               className="toggle-thumb duplicate-stroke"
//               aria-hidden="true"
//             ></div>
//           </div>

//           {/* ✅ Duplicate trough stroke INSIDE trough */}
//           <div
//             className="toggle-trough duplicate-stroke"
//             aria-hidden="true"
//           ></div>
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

// NestedToggle.tsx
import React from "react";
import "../../_main/main.css";
import { useToggleNode } from "./useToggleNode";
import { ToggleState } from "./ToggleTypes";

interface NestedToggleProps {
  id: string;
}

export default function NestedToggle({ id }: NestedToggleProps) {
  const { state, label, setState, ancestors } = useToggleNode(id);

  const handleClick = () => {
    let newState: ToggleState;
    switch (state) {
      case "on":
        newState = "off";
        break;
      case "cued":
        newState = "off";
        break;
      default:
        newState = "on";
        break;
    }
    setState(newState);
  };

  const text = state === "on" ? "LIVE" : state === "cued" ? "CUED" : "OFF";
  const generation = ancestors.length + 1;

  return (
    <div className="toggle-wrapper" onClick={handleClick}>
      <div className={`toggle-slider ${state}`}>
        {/* ✅ Size owner for trough; two identical troughs stacked inside */}
        <div className="trough-layer">
          {/* BASE trough (real background, padding, layout) */}
          <div className="toggle-trough base">
            {/* ✅ Size owner for thumb; two identical thumbs stacked inside */}
            <div className="thumb-layer">
              <div className="toggle-thumb base">
                <span className="toggle-text">{text}</span>
              </div>
              {/* DUPLICATE thumb stroke (transparent fill) */}
              <div
                className="toggle-thumb duplicate-stroke"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* DUPLICATE trough stroke (transparent fill) */}
          <div className="toggle-trough duplicate-stroke" aria-hidden="true" />
        </div>
      </div>

      <div className="toggle-circles">
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
