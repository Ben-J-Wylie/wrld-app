export type RenderMode = "dom" | "gl";
export type GlShader = "basic" | "lambert" | "unlit";
export type ObjectFit = "contain" | "cover";

export interface FeatureLayer {
  id: string;

  // DOM path (existing)
 Component?:
  | React.FC<React.SVGProps<SVGSVGElement>> // SVGs
  | React.FC<any>;                          // generic React components (e.g. NestedToggle)
  color?: string;

  // GL path (new)
  renderMode?: RenderMode;       // "dom" (default) or "gl"
  textureSrc?: string;           // png/jpg/webp/dataURL
  fit?: ObjectFit;               // contain | cover
  shader?: GlShader;             // basic | lambert | unlit

  // Common
  depth?: number;
  hoverDepthShift?: number;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;             // degrees
  scale?: number;
  opacity?: number;
  fixed?: boolean;
  zIndex?: number;
  style?: React.CSSProperties;
  onClick?: () => void;
}
