// metro.config.js
//
// This config:
//   1. Constrains which folders Metro watches (huge file-descriptor savings)
//   2. Blocks non-source paths from being scanned
//   3. Resolves `@/foo` imports to `src/foo`
//   4. Caps worker count for memory stability on older Macs

const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

// --- 1. Watch only the project root ---
config.watchFolders = [projectRoot]

// --- 2. Block non-source paths from resolution / watching ---
// We construct a single combined regex; this is what `exclusionList` does
// internally. Doing it inline avoids depending on Metro's private API.
const blocked = [
  /\.git\/.*/,
  /\.DS_Store$/,
  /\.vscode\/.*/,
  /\.expo\/.*/,
  /\.idea\/.*/,
  /ios\/Pods\/.*/,
  /ios\/build\/.*/,
  /android\/build\/.*/,
  /android\/app\/build\/.*/,
  /android\/\.gradle\/.*/,
  /\.tsbuildinfo$/,
  /coverage\/.*/,
  /backups\/.*/,
  /\.tmp\/.*/,
  // three.js ships thousands of example files that Metro doesn't need to watch.
  // Blocking them prevents EMFILE on file-descriptor-constrained Macs.
  /node_modules\/three\/examples\/.*/,
  /node_modules\/three\/src\/.*/,
]
config.resolver.blockList = new RegExp(blocked.map((r) => r.source).join('|'))

// --- 3. Map `@/foo` -> `<projectRoot>/src/foo` ---
const THREE_LOADER_STUB = path.resolve(projectRoot, 'stubs/threeLoaderStub.js')

const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // expo-three unconditionally imports these loaders; we don't use them and
  // three/examples/ is in the blockList, so redirect to an empty stub instead.
  if (moduleName.startsWith('three/examples/jsm/loaders/')) {
    return { type: 'sourceFile', filePath: THREE_LOADER_STUB }
  }
  if (moduleName.startsWith('@/')) {
    const rewritten = path.resolve(projectRoot, 'src', moduleName.slice(2))
    return context.resolveRequest(context, rewritten, platform)
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

// --- 4. Suppress package exports warnings from packages with incomplete
// exports fields (e.g. event-target-shim inside react-native-webrtc).
// Metro falls back to file resolution correctly; this just stops the noise.
config.resolver.unstable_enablePackageExports = false

// --- 5. Cap worker count ---
config.maxWorkers = 4

module.exports = config
