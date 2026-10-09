/**
 * Dynamic configuration for electron-builder.
 * Resolves the correct embedded Python runtime path based on target platform.
 */

const targetPlatform = process.env.TARGET_PLATFORM || (
  process.platform === 'win32' ? 'win32-x64' :
  process.platform === 'darwin' ? (process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64') :
  'linux-x64'
);
console.log(`[electron-builder] Building for target platform: ${targetPlatform}`);

module.exports = {
  $schema: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json',
  appId: 'com.sparta.agent',
  asar: true,
  asarUnpack: [
    'node_modules/@firecrawl/**/*',
  ],
  productName: 'Spartan',
  publish: {
    provider: 'github',
    owner: 'Naiker12',
    repo: 'Sparta-Agent',
  },
  compression: 'maximum',
  npmRebuild: false,
  directories: {
    output: `release/\${version}`
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'skills/**/*',
    'public/**/*',
    '!node_modules/**',
    'node_modules/@firecrawl/**/*',
    '!public/negro/**',
    '!**/*.map',
    '!**/*.tsbuildinfo'
  ],
  extraResources: [
    {
      // Document tools reuse only the lazy readers, not the RAG/model engines.
      from: 'desktop/backend-spartan/core/rag',
      to: 'backend/core/rag',
      filter: ['__init__.py', 'config.py', 'parsers.py'],
    },
    {
      from: 'desktop/backend-spartan',
      to: 'backend',
      filter: [
        '**/*',
        '!**/.venv/**',
        '!**/__pycache__/**',
        '!**/*.pyc',
        '!**/.pytest_cache/**',
        '!**/tests/**',
        '!**/.git/**',
        // API chat distribution with CPU Whisper voice. Local LLM engines,
        // offline RAG and model export are intentionally not shipped. Python is
        // retained because projects, file tools and terminal workflows use it.
        '!install_llama_prebuilt.py',
        '!routes/whisper.py',
        '!routes/rag.py',
        '!routes/rag_pkg/**',
        '!routes/export.py',
        '!core/rag/**',
        '!core/export/**',
        '!core/training/**',
        '!requirements/base.txt',
        '!requirements/overrides.txt',
        '!requirements/single-env/**',
      ],
    },
  ],
  icon: 'public/sparta-escritorio.png',
  mac: {
    // Squirrel.Mac consumes the ZIP and latest-mac.yml; the DMG is only the
    // manual installer. Keep both artifacts in every macOS release.
    target: ['dmg', 'zip'],
    artifactName: 'Sparta-Agent-Mac-\${version}-\${arch}-Installer.\${ext}',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: {
    icon: 'public/spartan.ico',
    requestedExecutionLevel: 'asInvoker',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    artifactName: 'Sparta-Agent-Windows-\${version}-Setup.\${ext}',
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    allowToChangeInstallationDirectory: false,
    // Remove Electron userData too: chats, settings, cached updater metadata,
    // and the local backend runtime must not remain after an uninstall.
    deleteAppDataOnUninstall: true
  },
  linux: {
    target: ['AppImage'],
    artifactName: 'Sparta-Agent-Linux-\${version}.\${ext}'
  }
};
