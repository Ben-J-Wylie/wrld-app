// ToggleTypes.ts

/** Effective state shown to UI or 3D toggle */
export type ToggleState = "on" | "off" | "cued";

/** A node in the nested toggle registry */
export interface ToggleNode {
  id: string;
  label: string;
  parentId?: string;

  /** Effective state (drives visuals): on | off | cued */
  state: ToggleState;

  /** User intention: "on" or "off" (never "cued") */
  desired: "on" | "off";

  /** Registered children */
  children: string[];
}

/** Event payload used for observers (if needed later) */
export interface ToggleChangeEvent {
  id: string;
  prevState: ToggleState;
  newState: ToggleState;
}

export type ToggleObserver = (event: ToggleChangeEvent) => void;
