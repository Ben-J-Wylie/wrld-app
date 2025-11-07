// useToggleNode.ts
import { useEffect, useState, useCallback } from "react";
import { toggleRegistry } from "./ToggleRegistry";
import { ToggleState } from "./ToggleTypes";

export function useToggleNode(id: string) {
  const [state, setState] = useState<ToggleState>("off");
  const [label, setLabel] = useState<string>("");
  const [ancestors, setAncestors] = useState<ToggleState[]>([]);

  useEffect(() => {
    const update = () => {
      const node = toggleRegistry.getNode(id);
      if (!node) return;

      // effective visual state
      setState(node.state);
      setLabel(node.label);

      // derive ancestor states for circle UI
      const ancestorNodes = toggleRegistry.getAncestors(id);
      setAncestors(ancestorNodes.map((a) => a.state));
    };

    const unsubscribe = toggleRegistry.subscribe(update);
    update();
    return () => {
      unsubscribe(); // cleanup returns void (fixes ts(2345))
    };
  }, [id]);

  // Only user-intent is toggled: "on" | "off" (never set "cued" directly)
  const setStateAndPropagate = useCallback((newState: ToggleState) => {
    const desired: "on" | "off" = newState === "cued" ? "on" : newState;
    toggleRegistry.updateState(id, desired);
  }, [id]);

  return { state, label, setState: setStateAndPropagate, ancestors };
}
