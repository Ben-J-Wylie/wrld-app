import React from "react";
export default function Triangle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" {...props}>
      <polygon points="50,0 100,100 0,100" />
    </svg>
  );
}
