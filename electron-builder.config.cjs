/**
 * Dynamic configuration for electron-builder.
 * Resolves the correct embedded Python runtime path based on target platform.
 */

const targetPlatform = process.env.TARGET_PLATFORM || (
  process.platform === 'win32' ? 'win32-x64' :
  process.platform === 'darwin' ? (process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64') :
  'linux-x64'
);
const hasAppleNotarizationCredentials = Boolean(
  process.env.APPLE_ID &&
  process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  process.env.APPLE_TEAM_ID,
);

console.log(`[electron-builder] Building for target platform: ${targetPlatform}`);

module.exports = {
  $schema: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json',
  appId: 'com.sparta.agent',
  asar: true,
  asarUnpack: [
    'node_modules/@firecrawl/**/*',
  ],
  productName: 'Sparta Agent',
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
    '!public/escritorio.png',
    '!public/post.png',
    '!public/readmin.png',
    '!**/*.map',
    '!**/*.tsbuildinfo'
  ],
  extraResources: [
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
      ],
    },
  ],
  icon: 'public/sparta-escritorio.png',
  mac: {
    target: ['dmg'],
    artifactName: 'Sparta-Agent-Mac-\${version}-Installer.\${ext}',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // CI enables this only once Apple credentials are supplied as secrets.
    notarize: hasAppleNotarizationCredentials,
  },
  // Turn this on in the release environment after both platform certificates
  // have been added. Keeping it configurable preserves unsigned local builds.
  forceCodeSigning: process.env.REQUIRE_CODE_SIGNING === 'true',
  win: {
    requestedExecutionLevel: 'asInvoker',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    artifactName: 'Sparta-Agent-Windows-\${version}-Setup.\${ext}',
    signAndEditExecutable: true,
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
