#!/usr/bin/env node
/**
 * Installs third-party requirements and local workspace packages
 * into the bundled Python runtime for production distribution.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'vendor');

// ── CLI args ─────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { platform: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) opts.platform = args[++i];
  }
  return opts;
}

function parsePlatformArg(platformOverride) {
  if (!platformOverride) return { os: process.platform, arch: process.arch };
  const parts = platformOverride.split('-');
  if (parts.length >= 2) {
    return { os: parts[0], arch: parts[1] };
  }
  return { os: process.platform, arch: process.arch };
}

function getPythonExecutable(platformOverride) {
  const { os, arch } = parsePlatformArg(platformOverride);
  const vdir = `python-${os}-${arch}`;
  const destDir = path.join(VENDOR_DIR, vdir);

  const pythonBin = os === 'win32'
    ? path.join(destDir, 'python.exe')
    : path.join(destDir, 'bin', 'python3');

  if (!fs.existsSync(pythonBin)) {
    console.error(`[setup-python] ERROR: Python binary not found at ${pythonBin}`);
    console.error(`[setup-python] Please run "pnpm python:fetch --platform ${os}-${arch}" first.`);
    process.exit(1);
  }

  return pythonBin;
}

function runCommand(command, args, cwd) {
  console.log(`[setup-python] Running: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    console.error(`[setup-python] Command failed with exit code ${result.status}`);
    process.exit(result.status || 1);
  }
}

function main() {
  const opts = parseArgs();
  const pythonBin = getPythonExecutable(opts.platform);
  console.log(`[setup-python] Found python at: ${pythonBin}`);

  // 1. Ensure pip is bootstrapped using get-pip.py
  const getPipScript = path.join(ROOT, 'vendor', 'get-pip.py');
  if (fs.existsSync(getPipScript)) {
    console.log('[setup-python] Bootstrapping pip using vendor/get-pip.py...');
    runCommand(pythonBin, [getPipScript], ROOT);
  } else {
    console.log('[setup-python] vendor/get-pip.py not found. Trying ensurepip as fallback...');
    try {
      runCommand(pythonBin, ['-m', 'ensurepip', '--upgrade'], ROOT);
    } catch (e) {
      console.warn('[setup-python] ensurepip failed. Attempting to run pip directly...');
    }
  }

  console.log('[setup-python] Upgrading pip to latest...');
  try {
    runCommand(pythonBin, ['-m', 'pip', 'install', '--upgrade', 'pip'], ROOT);
  } catch (e) {
    console.warn('[setup-python] pip upgrade failed. Continuing anyway...');
  }

  // 2. Install requirements.txt
  const reqPath = path.join(ROOT, 'python', 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    console.log(`[setup-python] Installing requirements from ${reqPath}...`);
    runCommand(pythonBin, ['-m', 'pip', 'install', '-r', reqPath], ROOT);
  } else {
    console.warn(`[setup-python] Warning: requirements.txt not found at ${reqPath}`);
  }

  // 3. Install workspace packages in normal (non-editable) mode
  const pythonDir = path.join(ROOT, 'python');
  const packages = [
    'py-sparta-errors',
    'py-sparta-config',
    'py-sparta-security',
    'py-sparta-providers',
    'py-sparta-audio',
    'py-sparta-persistence',
    'py-sparta-hooks',
    'py-sparta-memory',
    'py-sparta-streaming',
    'py-sparta-tools',
    'py-sparta-skills',
    'py-sparta-agents',
    'py-sparta-handlers',
    'py-sparta-mcp',
  ];

  console.log('[setup-python] Installing local packages...');
  for (const pkg of packages) {
    const pkgPath = path.join(pythonDir, pkg);
    if (fs.existsSync(pkgPath)) {
      runCommand(pythonBin, ['-m', 'pip', 'install', pkgPath], ROOT);
    } else {
      console.warn(`[setup-python] Warning: package directory not found at ${pkgPath}`);
    }
  }

  console.log('[setup-python] Python runtime setup complete!');
}

main();
