// ToggleRegistry.ts
import { ToggleNode, ToggleState } from "./ToggleTypes";

type Registry = Record<string, ToggleNode>;
type Listener = () => void;

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
  // Registration
  // -------------------------------------------------------------
  register(
    node: Omit<ToggleNode, "children" | "desired"> & { desired?: "on" | "off" }
  ) {
    const existing = this.registry[node.id];

    this.registry[node.id] = {
      ...existing,
      ...node,
      desired: node.desired ?? (node.state === "on" ? "on" : "off"),
      children: existing?.children || [],
    };

    // attach to parent
    if (node.parentId) {
      const parent = this.registry[node.parentId];
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }

    // compute correct effective state
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

    // root nodes can never be cued
    if (!node.parentId) {
      node.state = node.desired;
      return;
    }

    // if ancestors block on → transform desired:on → cued
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

      // continue downward
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
