import { ToggleState } from "./ToggleTypes";

export const toggleFamilyConfig = {
  //  FIRST GEN
  GlobalLive: {
    id: "GlobalLive",
    label: "PARENT",
    parentId: undefined,
    state: "off" as ToggleState,
  },

  // SECOND GEN:

  child1: {
    id: "child1",
    label: "CHILD 1",
    parentId: "GlobalLive",
    state: "off" as ToggleState,
  },
  child2: {
    id: "child2",
    label: "CHILD 2",
    parentId: "GlobalLive",
    state: "off" as ToggleState,
  },

  grandchild: {
    id: "grandchild",
    label: "GRANDCHILD",
    parentId: "child2",
    state: "off" as ToggleState,
  },
};
