// SceneCore/index.ts
// -----------------------------------------------------------------------------
// Root barrel for SceneCore.
// Exposes global config, store, engine, cameras, controllers, layers.
// -----------------------------------------------------------------------------

export { SceneConfig } from "./SceneConfig";
export { useSceneStore } from "./SceneStore";

// Subsystems
export * as Engine from "./Engine";
export * as Cameras from "./Cameras";
export * as Controllers from "./Controllers";
export * as Layers from "./Layers";