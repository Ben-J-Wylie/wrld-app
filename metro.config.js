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
]
config.resolver.blockList = new RegExp(blocked.map((r) => r.source).join('|'))

// --- 3. Map `@/foo` -> `<projectRoot>/src/foo` ---
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const rewritten = path.resolve(projectRoot, 'src', moduleName.slice(2))
    return context.resolveRequest(context, rewritten, platform)
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

// --- 4. Cap worker count ---
config.maxWorkers = 4

module.exports = config
