// ToggleNode.ts
import { useEffect, useState, useCallback } from "react";
import { toggleRegistry } from "./ToggleRegistry";
import { ToggleState } from "./ToggleState";

export function ToggleNode(id: string) {
  const [state, setState] = useState<ToggleState>("off");
  const [label, setLabel] = useState<string>("");
  const [ancestors, setAncestors] = useState<ToggleState[]>([]);

  useEffect(() => {
    const update = () => {
      const node = toggleRegistry.getNode(id);
      if (!node) return;

      setState(node.state);
      setLabel(node.label);

      const ancestorNodes = toggleRegistry.getAncestors(id);
      setAncestors(ancestorNodes.map((a) => a.state));
    };

    const unsubscribe = toggleRegistry.subscribe(update);
    update();
    return () => {
      unsubscribe();
    };
  }, [id]);

  // only sets desired:on/off
  const setStateAndPropagate = useCallback(
    (newState: ToggleState) => {
      const desired: "on" | "off" = newState === "cued" ? "on" : newState;
      toggleRegistry.updateState(id, desired);
    },
    [id]
  );

  return { state, label, setState: setStateAndPropagate, ancestors };
}
