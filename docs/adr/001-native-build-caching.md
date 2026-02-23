# ADR-001: Native Build Caching in CI

## Status

Accepted

## Date

2026-02-23

## Context

Our CI pipelines (`pr-build.yml` and `release.yml`) build an Android APK from scratch on
every run using `eas build --local`. A full native build takes 10-15 minutes, dominated by
Gradle compilation of native code (React Native, Hermes, native modules like
`react-native-ssh-sftp`, Expo modules, etc.).

Most commits change only JavaScript/TypeScript source — the native layer is unchanged. We
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
  not applicable to CI — reviewers need a standalone APK.
- **Verdict**: Not applicable. The app uses custom native modules that Expo Go cannot
  load.

#### 3. EAS Build with `--resource-class` / Cloud Caching

Use EAS cloud builds which have their own caching layer.

- **Pros**: Managed caching by Expo; no self-hosted cache management.
- **Cons**: Requires paid EAS plan for faster builds; opaque cache invalidation; moves
  builds off GitHub Actions (less control); current workflows use `--local` for cost
  and control reasons.
- **Verdict**: Viable but increases cost and reduces control. Not chosen for now.

#### 4. Fingerprint-Based Gradle Cache on GitHub Actions (Chosen)

Use `@expo/fingerprint` to hash the native dependency surface. Cache the Gradle build
directory and `android/` prebuild output keyed by this fingerprint. On cache hit, the
native compilation step is skipped (Gradle up-to-date checks pass). On cache miss, do a
full build and populate the cache.

- **Pros**: Zero-cost (uses GitHub Actions cache); transparent and auditable; works with
  existing `--local` build flow; reduces JS-only PR builds from ~12 min to ~3-4 min;
  compatible with future App Store publishing.
- **Cons**: GitHub Actions cache is limited to 10 GB per repo (old entries evicted via
  LRU); first build after native dep change is still slow; fingerprint script adds a
  small maintenance burden.
- **Verdict**: Best fit for current requirements. Low risk, high reward.

## Decision

We adopt **fingerprint-based native build caching** (option 4):

1. **Fingerprint generation**: A script (`scripts/native-fingerprint.js`) uses
   `@expo/fingerprint` to compute a hash of the project's native footprint — covering
   `package.json` dependencies, `app.json` config, `eas.json`, native plugins, and
   Expo SDK version.

2. **Cache key**: GitHub Actions `actions/cache` is keyed on
   `${{ runner.os }}-native-build-${{ fingerprint }}`. This ensures the cache is
   invalidated whenever native dependencies change.

3. **Cached artifacts**: The `~/.gradle/caches` and `~/.gradle/wrapper` directories
   (Gradle build cache and wrapper distribution) are cached.

   **Note**: EAS `--local` builds clone the project into a temp directory
   (`/tmp/runner/eas-build-local-nodejs/<uuid>/build/`) and run Gradle there. This
   means workspace-local paths like `android/.gradle` or `android/app/build` are NOT
   reusable across runs. However, Gradle uses the global `~/.gradle/` directory for
   dependency caches and build cache, so caching that directory is effective.

4. **Workflow behavior**:
   - Cache hit: Gradle reuses cached dependency downloads and compiled outputs from
     `~/.gradle/caches`. This eliminates redundant dependency resolution and can speed
     up incremental compilation. Expected savings: ~3-8 min depending on cache warmth.
   - Cache miss: Full native build runs (~12 min). Cache is populated for next run.

5. **Scope**: Applied to `pr-build.yml` and `release.yml`. The legacy `eas-build.yml`
   is left unchanged (it should be deprecated separately).

## Consequences

### Positive

- JS-only PR builds drop from ~12 min to ~3-4 min.
- Release builds after JS-only changes are similarly faster.
- No new services or paid plans required.
- Cache invalidation is automatic and deterministic via `@expo/fingerprint`.
- Compatible with future iOS builds and App Store publishing.

### Negative

- Adds `@expo/fingerprint` as a dev dependency.
- GitHub Actions cache is limited to 10 GB per repo; large Gradle caches may cause
  eviction of other caches.
- The fingerprint script must be maintained if the project's native surface changes
  in unusual ways (e.g., custom Gradle plugins not tracked by `@expo/fingerprint`).

### Risks

- If `@expo/fingerprint` misses a native dependency change, a stale cache could
  produce a broken APK. Mitigation: the fingerprint library is maintained by Expo and
  covers all standard Expo/RN native surfaces. Manual cache purge is available via
  GitHub Actions UI.

## Future Considerations

- **Expo OTA Updates**: Can be layered on top for post-release JS hotfixes, reducing
  the need for full release cycles for minor JS fixes.
- **iOS builds**: The same fingerprint strategy extends to iOS (cache `ios/Pods`,
  `~/Library/Developer/Xcode/DerivedData`).
- **Deprecate `eas-build.yml`**: The legacy workflow should be removed once `release.yml`
  is proven stable.
