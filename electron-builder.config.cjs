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
  asarUnpack: ['python/**', 'node_modules/node-pty/**/*'],
  productName: 'Sparta Agent',
  npmRebuild: false,
  directories: {
    output: `release/\${version}`
  },
  files: [
    'dist',
    'dist-electron',
    'node_modules/node-pty/**/*',
    'public/**/*'
  ],
  extraResources: [
    {
      from: 'python',
      to: 'python',
      filter: [
        '**/*',
        '!**/.venv/**',
        '!**/__pycache__/**',
        '!**/*.pyc',
        '!**/*.pyo',
        '!**/.pytest_cache/**',
        '!**/.ruff_cache/**',
        '!**/.mypy_cache/**',
        '!**/build/**',
        '!**/*.dist-info/**',
        '!**/*.egg-info/**',
        '!**/*.log'
      ]
    },
    {
      from: 'desktop/runtime/ia-sparta-security-rust',
      to: 'rust/sparta-security',
      filter: ['*.node', 'index.js', 'index.d.ts']
    },
    {
      from: `vendor/python-${targetPlatform}`,
      to: 'python-runtime',
      filter: [
        '**/*',
        '!**/tcl/**',
        '!**/tkinter/**',
        '!**/test/**',
        '!**/tests/**',
        '!**/idlelib/**',
        '!**/*.pyc',
        '!**/__pycache__/**'
      ]
    }
  ],
  icon: 'public/sparta-escritorio.png',
  mac: {
    target: ['dmg'],
    artifactName: 'Sparta-Agent-Mac-\${version}-Installer.\${ext}'
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    artifactName: 'Sparta-Agent-Windows-\${version}-Setup.\${ext}'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  },
  linux: {
    target: ['AppImage'],
    artifactName: 'Sparta-Agent-Linux-\${version}.\${ext}'
  }
};
