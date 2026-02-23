# ADR-001: Native Build Caching in CI

## Status

Accepted (revised 2026-02-23)

## Date

2026-02-23

## Context

Our CI pipelines (`pr-build.yml` and `release.yml`) build an Android APK from scratch on
every run. A full native build takes 15-25 minutes, dominated by Gradle compilation of
native code (React Native New Architecture C++ codegen, Hermes, native modules like
`react-native-ssh-sftp`, Expo modules, CMake builds for 4 ABIs).

Most commits change only JavaScript/TypeScript source -- the native layer is unchanged. We
need a strategy to skip redundant native compilation and only rebuild when native
dependencies actually change.

### Requirements

| Requirement | Priority |
|---|---|
| Production release builds on push to `main` | Must have |
| PR preview APK builds | Must have |
| App Store publishing (future) | Nice to have |
| Fast feedback on JS-only changes | Must have |

### Alternatives Considered

#### 1. Expo OTA Updates (EAS Update / `expo-updates`)

Ship JS bundle changes over-the-air without rebuilding the native binary.

- **Pros**: Near-instant delivery; no native build at all for JS changes; built-in
  rollback; Expo-managed CDN hosting.
- **Cons**: Requires `expo-updates` SDK integration (adds native dependency); does not
  produce a downloadable APK for PR review; requires a prior native build to exist on
  devices; not suitable for App Store submissions; adds runtime update-checking logic.
- **Verdict**: Excellent for post-release hotfixes, but does not replace CI APK builds
  for PR review or release publishing. Can complement this ADR as a future enhancement.

#### 2. Expo Go / Development Builds

Run JS bundles inside the Expo Go app or a pre-built development client.

- **Pros**: No build step at all during development.
- **Cons**: Expo Go cannot run custom native modules (`react-native-ssh-sftp`); dev
  builds still require an initial native build; not suitable for release distribution;
  not applicable to CI -- reviewers need a standalone APK.
- **Verdict**: Not applicable. The app uses custom native modules that Expo Go cannot
  load.

#### 3. EAS Build with `--resource-class` / Cloud Caching

Use EAS cloud builds which have their own caching layer.

- **Pros**: Managed caching by Expo; no self-hosted cache management.
- **Cons**: Requires paid EAS plan for faster builds; opaque cache invalidation; moves
  builds off GitHub Actions (less control); current workflows use `--local` for cost
  and control reasons.
- **Verdict**: Viable but increases cost and reduces control. Not chosen for now.

#### 4. EAS Build `--local` with Gradle Cache (Initial Approach -- Rejected)

Use `eas build --local` as before, but cache `~/.gradle/caches` keyed by a fingerprint.

- **Pros**: Minimal workflow changes; caches Gradle dependency downloads (~1.3 GB).
- **Cons**: EAS `--local` copies the project to a temp directory
  (`/tmp/runner/eas-build-local-nodejs/<uuid>/build/`) and runs Gradle there. All
  compiled native outputs (`.so` files, Kotlin class files, CMake artifacts) are
  discarded after each run. Only dependency downloads in `~/.gradle/caches` survive.
  Tested in CI: reduced build from 25m to 17m (31% improvement), but native
  compilation still runs in full every time.
- **Verdict**: Insufficient. The temp directory model fundamentally prevents caching
  the expensive native compilation outputs.

#### 5. Direct `expo prebuild` + Gradle (Chosen)

Replace `eas build --local` with `npx expo prebuild --platform android` followed by
`./gradlew :app:assembleRelease` directly in the workspace. Cache the full Gradle build
output directory.

- **Pros**: Builds happen in-place so `android/app/build/` persists between runs;
  CMake `.so` files, Kotlin class files, C++ codegen outputs are all cacheable; removes
  EAS CLI dependency; no `EXPO_TOKEN` needed for builds; full control over signing.
- **Cons**: Must handle signing config ourselves (previously managed by EAS); lose EAS
  `expo-doctor` pre-flight checks; must replicate `eas-build.gradle` signing file.
- **Verdict**: Best fit. Solves the core caching problem.

## Decision

We adopt **direct prebuild + Gradle with fingerprint-based caching** (option 5):

1. **Build process**: CI runs `npx expo prebuild --platform android --clean` to generate
   the `android/` directory, then `./gradlew :app:assembleRelease` directly in the
   workspace.

2. **Fingerprint generation**: A script (`scripts/native-fingerprint.js`) uses
   `@expo/fingerprint` to compute a hash of the project's native footprint -- covering
   `package.json` dependencies, `app.json` config, `eas.json`, native plugins, and
   Expo SDK version.

3. **Signing**: CI creates an `android/app/eas-build.gradle` file (the same file that
   `expo prebuild` generates an `apply from` directive for) with the keystore path and
   credentials. PR builds use an ephemeral keystore; release builds use the production
   keystore from GitHub Secrets.

4. **Two-tier caching**:

   | Cache | Key | Contents |
   |---|---|---|
   | Gradle dependencies | `gradle-deps-${{ hashFiles('android/**/*.gradle*') }}` | `~/.gradle/caches`, `~/.gradle/wrapper` (downloaded JARs, AARs, Gradle distribution) |
   | Native build outputs | `native-build-${{ fingerprint }}` | `android/.gradle`, `android/app/build`, `android/build` (compiled `.so`, `.class`, codegen, APK intermediates) |

   The dependency cache uses Gradle file hashes (changes when `build.gradle` files
   change). The build output cache uses the native fingerprint (changes when any native
   dependency changes). On fingerprint match, Gradle's up-to-date checks skip all native
   compilation.

5. **EAS CLI removed**: The `expo/expo-github-action` setup step and `EXPO_TOKEN`
   environment variable are no longer needed for builds. This simplifies CI setup and
   removes a third-party dependency from the build path.

6. **Scope**: Applied to `pr-build.yml` and `release.yml`. The legacy `eas-build.yml`
   is left unchanged (it should be deprecated separately).

## Consequences

### Positive

- JS-only PR builds drop from ~18 min to ~3-4 min (native compilation fully cached).
- Release builds after JS-only changes are similarly faster.
- No new services or paid plans required.
- Cache invalidation is automatic and deterministic via `@expo/fingerprint`.
- Removes EAS CLI dependency from CI build path.
- Compatible with future iOS builds and App Store publishing.

### Negative

- Must maintain signing config generation in CI (previously handled by EAS).
- GitHub Actions cache is limited to 10 GB per repo; native build outputs for 4 ABIs
  can be 1-2 GB, which may cause eviction of other caches.
- The fingerprint script must be maintained if the project's native surface changes
  in unusual ways (e.g., custom Gradle plugins not tracked by `@expo/fingerprint`).

### Risks

- If `@expo/fingerprint` misses a native dependency change, a stale cache could
  produce a broken APK. Mitigation: the fingerprint library is maintained by Expo and
  covers all standard Expo/RN native surfaces. The native build output cache has no
  `restore-keys` fallback, so a fingerprint change always triggers a full rebuild.
  Manual cache purge is available via GitHub Actions UI.

- `expo prebuild --clean` regenerates `android/` from scratch, which may overwrite
  cached `android/app/build/` intermediate files. Gradle's incremental build should
  handle this gracefully (rebuilds only what changed), but if issues arise, removing
  `--clean` or adjusting the prebuild step may be needed.

## Future Considerations

### Committing `android/` to version control

Currently `android/` is gitignored. This means `expo prebuild --clean` regenerates it
on every CI run (~30-60s), and the native build cache must include the full `android/`
build output directory.

**Tradeoffs of committing `android/`:**

| Factor | Gitignored (current) | Committed |
|---|---|---|
| Repo size | Small (no native files) | Larger (+5-10 MB of generated files) |
| CI prebuild step | Required every run (~30-60s) | Skippable (already exists) |
| Cache effectiveness | Good (build outputs cached) | Better (no prebuild drift risk) |
| Local dev consistency | Developers must run prebuild | Consistent across machines |
| Expo SDK upgrades | Clean prebuild always uses latest templates | Must manually re-run prebuild and commit |
| Merge conflicts | None (generated files not in git) | Possible in generated Gradle files |
| Config plugin changes | Automatically reflected | Must re-run prebuild and commit |

**Recommendation**: Keep `android/` gitignored for now. The current caching strategy
works well, and the prebuild step is fast. Revisit if:
- Multiple developers need consistent local Android builds
- Prebuild drift causes cache invalidation issues
- iOS builds are added to CI (same decision applies to `ios/`)

### Expo OTA Updates

Can be layered on top for post-release JS hotfixes, reducing the need for full release
cycles for minor JS fixes. Requires adding `expo-updates` as a native dependency.

### iOS builds

The same fingerprint + direct build strategy extends to iOS:
- `npx expo prebuild --platform ios --clean`
- `xcodebuild` directly in the workspace
- Cache `ios/Pods`, `ios/build`, `~/Library/Developer/Xcode/DerivedData`

### Deprecate `eas-build.yml`

The legacy workflow should be removed once `release.yml` is proven stable.
