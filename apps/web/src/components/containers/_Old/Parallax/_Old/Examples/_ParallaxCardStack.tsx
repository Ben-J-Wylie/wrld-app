import React from "react";
import ParallaxItem from "../ParallaxItem";

type Props = {
  top: string;
  left: string;
  count?: number;
  color?: string;
  spacing?: number;
};

export default function ParallaxCardStack({
  top,
  left,
  count = 3,
  color = "#fff",
  spacing = 1, // how much depth difference between cards
}: Props) {
  const cards = Array.from({ length: count }, (_, i) => {
    const depth = i * spacing; // 0, 1, 2...
    const tint = 1 - i * 0.1; // slightly dimmer for depth cue
    return (
      <ParallaxItem key={i} depth={depth} style={{ top, left }}>
        <div
          style={{
            width: 200,
            height: 120,
            background: color,
            borderRadius: 12,
            boxShadow: "0 0 15px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 600,
            color: `rgba(0,0,0,${tint})`,
          }}
        >
          Card {i + 1}
        </div>
      </ParallaxItem>
    );
  });

  return <>{cards}</>;
}
