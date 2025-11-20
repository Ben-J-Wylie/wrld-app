import React from "react";
export default function Circle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <circle cx="50" cy="50" r="50" />
    </svg>
  );
}
