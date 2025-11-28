// ToggleRegistry.ts
import { ToggleNode, ToggleState } from "./ToggleState";

type Registry = Record<string, ToggleNode>;
type Listener = () => void;

// Optional helper type for tree configs like ToggleTree / ToggleFamily
export interface ToggleTreeNodeDef {
  id: string;
  label: string;
  parentId?: string;
  state: ToggleState;
}

class ToggleRegistry {
  private registry: Registry = {};
  private listeners: Set<Listener> = new Set();

  // -------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  // -------------------------------------------------------------
  // Registration (per-node, usually from UI)
  // -------------------------------------------------------------
  register(
    node: Omit<ToggleNode, "children" | "desired"> & { desired?: "on" | "off" }
  ) {
    const existing = this.registry[node.id];

    this.registry[node.id] = {
      ...existing,
      ...node,
      // If caller doesn't specify desired, keep existing.desired if present,
      // otherwise infer from state.
      desired:
        node.desired ??
        existing?.desired ??
        (node.state === "on" ? "on" : "off"),
      // Preserve existing children if any
      children: existing?.children || [],
    };

    // Attach to parent
    if (node.parentId) {
      const parent = this.registry[node.parentId];
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }

    // Compute correct effective state for this node
    this.recalculateNode(node.id);

    this.notify();
  }

  unregister(id: string) {
    const node = this.registry[id];
    if (!node) return;

    if (node.parentId) {
      const parent = this.registry[node.parentId];
      if (parent) {
        parent.children = parent.children.filter((cid) => cid !== id);
      }
    }

    delete this.registry[id];
    this.notify();
  }

  // -------------------------------------------------------------
  // Bulk load from a static tree definition
  // (e.g., from toggleFamilyConfig.ts)
  // -------------------------------------------------------------
  loadFromTree(tree: Record<string, ToggleTreeNodeDef>) {
    // Reset everything and rebuild from the tree
    this.registry = {};

    // 1) First pass: create base nodes
    for (const key in tree) {
      const def = tree[key];

      this.registry[def.id] = {
        id: def.id,
        label: def.label,
        parentId: def.parentId,
        state: def.state,
        desired: def.state === "on" ? "on" : "off",
        children: [],
      };
    }

    // 2) Second pass: wire up children
    for (const key in tree) {
      const def = tree[key];
      if (def.parentId) {
        const parent = this.registry[def.parentId];
        if (parent && !parent.children.includes(def.id)) {
          parent.children.push(def.id);
        }
      }
    }

    // 3) Third pass: recalculate effective state for all nodes
    for (const key in tree) {
      const def = tree[key];
      this.recalculateNode(def.id);
    }

    // 4) Notify subscribers once
    this.notify();
  }

  // -------------------------------------------------------------
  // State update
  // -------------------------------------------------------------
  updateState(id: string, newDesired: "on" | "off") {
    const node = this.registry[id];
    if (!node) return;

    node.desired = newDesired;

    this.recalculateNode(id);
    this.cascadeDown(id);

    this.notify();
  }

  // -------------------------------------------------------------
  // Logic — Calculation per node
  // -------------------------------------------------------------
  private recalculateNode(id: string) {
    const node = this.registry[id];
    if (!node) return;

    const ancestors = this.getAncestors(id);
    const ancestorOff = ancestors.some((a) => a.state === "off");
    const ancestorCued = ancestors.some((a) => a.state === "cued");

    // Root nodes can never be cued
    if (!node.parentId) {
      node.state = node.desired;
      return;
    }

    // If ancestors block "on" → transform desired:on → cued
    if ((ancestorOff || ancestorCued) && node.desired === "on") {
      node.state = "cued";
    } else {
      node.state = node.desired;
    }
  }

  // -------------------------------------------------------------
  // Propagate constraints to children
  // -------------------------------------------------------------
  private cascadeDown(id: string) {
    const node = this.registry[id];
    if (!node) return;

    for (const childId of node.children) {
      const child = this.registry[childId];
      if (!child) continue;

      const ancestors = this.getAncestors(childId);
      const ancestorOff = ancestors.some((a) => a.state === "off");
      const ancestorCued = ancestors.some((a) => a.state === "cued");

      if ((ancestorOff || ancestorCued) && child.desired === "on") {
        child.state = "cued";
      } else {
        child.state = child.desired;
      }

      // Continue downward
      this.cascadeDown(childId);
    }
  }

  // -------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------
  getNode(id: string) {
    return this.registry[id];
  }

  getAll() {
    return { ...this.registry };
  }

  getAncestors(id: string): ToggleNode[] {
    const ancestors: ToggleNode[] = [];
    let current = this.registry[id];

    while (current?.parentId) {
      const parent = this.registry[current.parentId];
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  }

  clear() {
    this.registry = {};
    this.notify();
  }
}

export const toggleRegistry = new ToggleRegistry();
