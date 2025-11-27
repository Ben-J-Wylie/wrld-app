// ToggleRegistry.ts
import { ToggleState } from "./ToggleTypes";

export interface ToggleNode {
  id: string;
  label: string;
  parentId?: string;
  /** Effective state visible to UI: "on" | "off" | "cued" */
  state: ToggleState;
  /** The user's intended switch position: "on" | "off" */
  desired: "on" | "off";
  children: string[];
}

type Registry = Record<string, ToggleNode>;
type Listener = () => void;

class ToggleRegistry {
  private registry: Registry = {};
  private listeners: Set<Listener> = new Set();

  // === Subscriptions ===
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  // === Registration ===
  register(node: Omit<ToggleNode, "children" | "desired"> & { desired?: "on" | "off" }) {
    const existing = this.registry[node.id];
    this.registry[node.id] = {
      ...existing,
      ...node,
      desired: node.desired ?? (node.state === "on" ? "on" : "off"),
      children: existing?.children || [],
    };

    if (node.parentId) {
      const parent = this.registry[node.parentId];
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }

    // After registration, recompute effective state
    this.recalculateNode(node.id);

    this.notify();
  }

  unregister(id: string) {
    const node = this.registry[id];
    if (!node) return;

    if (node.parentId) {
      const parent = this.registry[node.parentId];
      if (parent) parent.children = parent.children.filter((cid) => cid !== id);
    }

    delete this.registry[id];
    this.notify();
  }

  // === State Updates ===
  updateState(id: string, newDesired: "on" | "off") {
    const node = this.registry[id];
    if (!node) return;

    node.desired = newDesired;

    // Recalculate its own effective state based on ancestry
    this.recalculateNode(id);

    // Propagate down using THIS node's updated state
    this.cascadeDown(id, this.registry[id].state);

    this.notify();
  }

  /**
   * Derives the node's effective state based on ancestry and its own desired position.
   * - If any ancestor is off or cued → desired:on => state:cued
   * - If any ancestor is off or cued → desired:off => state:off
   * - If all ancestors are on → state = desired
   */
  private recalculateNode(id: string) {
    const node = this.registry[id];
    if (!node) return;

    const ancestors = this.getAncestors(id);
    const anyAncestorOff = ancestors.some((a) => a.state === "off");
    const anyAncestorCued = ancestors.some((a) => a.state === "cued");

    // root nodes (no parent) never become cued; they equal desired
    if (!node.parentId) {
      node.state = node.desired;
      return;
    }

    if ((anyAncestorOff || anyAncestorCued) && node.desired === "on") {
      node.state = "cued";
    } else {
      node.state = node.desired;
    }
  }

  /**
   * Downward propagation (true nested).
   *  - If any ancestor is off or cued → descendants desiring "on" become "cued"
   *  - Otherwise children take their desired state
   *  - Then descend using EACH CHILD'S updated state (not the original)
   */
  private cascadeDown(id: string, controllingState: ToggleState) {
    const node = this.registry[id];
    if (!node) return;

    node.children.forEach((childId) => {
      const child = this.registry[childId];
      if (!child) return;

      const ancestors = this.getAncestors(childId);
      const anyAncestorOff = ancestors.some((a) => a.state === "off");
      const anyAncestorCued = ancestors.some((a) => a.state === "cued");

      if ((anyAncestorOff || anyAncestorCued) && child.desired === "on") {
        child.state = "cued";
      } else {
        child.state = child.desired;
      }

      // Recurse using the child's updated state so grandchildren inherit properly
      this.cascadeDown(childId, child.state);
    });
  }

  // === Helpers ===
  getNode(id: string) {
    return this.registry[id];
  }

  getAncestors(id: string) {
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

  getAll() {
    return { ...this.registry };
  }

  clear() {
    this.registry = {};
    this.notify();
  }
}

export const toggleRegistry = new ToggleRegistry();
