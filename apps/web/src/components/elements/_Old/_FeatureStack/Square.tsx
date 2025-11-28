import React from "react";
export default function Square(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <rect x="0" y="0" width="100" height="100" />
    </svg>
  );
}
