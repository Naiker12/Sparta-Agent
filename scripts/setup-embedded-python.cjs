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

function getPythonExecutable() {
  // Detect target platform vendor folder
  const os = process.platform;
  const arch = process.arch;
  const vdir = `python-${os}-${arch}`;
  const destDir = path.join(VENDOR_DIR, vdir);

  const pythonBin = os === 'win32'
    ? path.join(destDir, 'python.exe')
    : path.join(destDir, 'bin', 'python3');

  if (!fs.existsSync(pythonBin)) {
    console.error(`[setup-python] ERROR: Python binary not found at ${pythonBin}`);
    console.error(`[setup-python] Please run "pnpm python:fetch" first.`);
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
  const pythonBin = getPythonExecutable();
  console.log(`[setup-python] Found python at: ${pythonBin}`);

  // 1. Install requirements.txt
  const reqPath = path.join(ROOT, 'python', 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    console.log(`[setup-python] Installing requirements from ${reqPath}...`);
    runCommand(pythonBin, ['-m', 'pip', 'install', '-r', reqPath], ROOT);
  } else {
    console.warn(`[setup-python] Warning: requirements.txt not found at ${reqPath}`);
  }

  // 2. Install workspace packages in normal (non-editable) mode
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
