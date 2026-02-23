#!/usr/bin/env node

/**
 * Generates a fingerprint hash of the project's native dependency surface.
 *
 * Uses @expo/fingerprint to hash everything that affects the native build:
 * - Native dependencies in package.json
 * - app.json / app.config.js configuration
 * - eas.json build profiles
 * - Expo config plugins
 * - Expo SDK version
 * - Native code in ios/ and android/ (if present)
 *
 * Usage:
 *   node scripts/native-fingerprint.js [--platform android|ios]
 *
 * Output:
 *   Prints the fingerprint hash to stdout (40-char hex string).
 *   Suitable for use as a cache key in CI.
 */

const { createProjectHashAsync } = require("@expo/fingerprint");
const path = require("path");

async function main() {
  const args = process.argv.slice(2);
  let platform = "android";

  const platformIdx = args.indexOf("--platform");
  if (platformIdx !== -1 && args[platformIdx + 1]) {
    platform = args[platformIdx + 1];
  }

  const projectRoot = path.resolve(__dirname, "..");

  try {
    const hash = await createProjectHashAsync(projectRoot, {
      platforms: [platform],
    });

    // Print only the hash to stdout for easy capture in CI
    process.stdout.write(hash);
  } catch (error) {
    console.error("Failed to generate native fingerprint:", error.message);
    process.exit(1);
  }
}

main();
