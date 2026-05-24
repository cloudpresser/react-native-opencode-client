#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const expoDir = path.join(projectRoot, '.expo');

const trackedInputs = [
  'app.json',
  'package.json',
  'yarn.lock',
  'package-lock.json',
  'app.config.js',
  'app.config.ts',
  'app.config.mjs',
  'app.config.cjs',
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  'plugins',
];

function walk(filePath, files) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filePath).sort();
    for (const entry of entries) {
      walk(path.join(filePath, entry), files);
    }
    return;
  }

  files.push(filePath);
}

function fingerprintNativeInputs(platform) {
  const hash = crypto.createHash('sha256');
  hash.update(`platform:${platform}\n`);

  const files = [];
  for (const relativePath of trackedInputs) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    walk(absolutePath, files);
  }

  files.sort();

  for (const absolutePath of files) {
    const relativePath = path.relative(projectRoot, absolutePath);
    hash.update(`file:${relativePath}\n`);
    hash.update(fs.readFileSync(absolutePath));
    hash.update('\n');
  }

  return hash.digest('hex');
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureExpoDir() {
  if (!fs.existsSync(expoDir)) {
    fs.mkdirSync(expoDir, { recursive: true });
  }
}

function getMarkerPath(platform) {
  return path.join(expoDir, `native-fingerprint-${platform}`);
}

function readMarker(platform) {
  const markerPath = getMarkerPath(platform);
  if (!fs.existsSync(markerPath)) {
    return null;
  }

  return fs.readFileSync(markerPath, 'utf8').trim();
}

function writeMarker(platform, fingerprint) {
  ensureExpoDir();
  fs.writeFileSync(getMarkerPath(platform), `${fingerprint}\n`, 'utf8');
}

function ensureNativeProject(platform) {
  const nativeDir = path.join(projectRoot, platform);
  const currentFingerprint = fingerprintNativeInputs(platform);
  const previousFingerprint = readMarker(platform);
  const missingNativeDir = !fs.existsSync(nativeDir);
  const stale = previousFingerprint !== currentFingerprint;

  if (missingNativeDir || stale) {
    run('npx', ['expo', 'prebuild', '--clean', '--platform', platform]);
    writeMarker(platform, currentFingerprint);
  }
}

function main() {
  const [, , platform, ...restArgs] = process.argv;
  if (platform !== 'ios' && platform !== 'android') {
    console.error('Usage: node scripts/run-native.js <ios|android> [...expo-run-args]');
    process.exit(1);
  }

  ensureNativeProject(platform);

  const runArgs = [...restArgs];
  const hasExplicitDevice = runArgs.includes('-d') || runArgs.includes('--device');
  if (platform === 'ios' && !hasExplicitDevice) {
    runArgs.push('-d', process.env.EXPO_IOS_DEVICE || 'iPhone 16');
  }

  run('npx', ['expo', `run:${platform}`, ...runArgs]);
}

main();
