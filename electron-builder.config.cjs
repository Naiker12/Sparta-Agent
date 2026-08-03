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
  asarUnpack: ['node_modules/node-pty/**/*'],
  productName: 'Sparta Agent',
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
    'node_modules/node-pty/**/*',
    '!public/negro/**',
    '!public/escritorio.png',
    '!public/post.png',
    '!public/readmin.png'
  ],
  extraResources: [],
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
