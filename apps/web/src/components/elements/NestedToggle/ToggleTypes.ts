// ToggleTypes.ts

/** Core toggle state */
export type ToggleState = "on" | "off" | "cued";

/** Identifies a toggle node in the registry */
export interface ToggleNode {
  id: string;
  label: string;
  state: ToggleState;
  parentId?: string;
  childrenIds?: string[];
}

/** Event payload for changes */
export interface ToggleChangeEvent {
  id: string;
  prevState: ToggleState;
  newState: ToggleState;
}

/** Function signature for observers */
export type ToggleObserver = (event: ToggleChangeEvent) => void;
