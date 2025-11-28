export interface StreamingCapability {
  key: string; // "camera"
  label: string; // "Camera"
  icon?: string; // optional icon path
  onEnable: () => Promise<void>; // start publishing
  onDisable: () => Promise<void>; // stop publishing
}
