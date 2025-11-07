// toggleConfig.ts
import { ToggleState } from "./ToggleTypes";

export const toggleFamilyConfig = {
  parent: {
    id: "parent",
    label: "PARENT",
    parentId: undefined,
    state: "on" as ToggleState,
  },
  child1: {
    id: "child1",
    label: "CHILD 1",
    parentId: "parent",
    state: "off" as ToggleState,
  },
  child2: {
    id: "child2",
    label: "CHILD 2",
    parentId: "parent",
    state: "on" as ToggleState,
  },
  grandchild: {
    id: "grandchild",
    label: "GRANDCHILD",
    parentId: "child2",
    state: "off" as ToggleState,
  },
};
