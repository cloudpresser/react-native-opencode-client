## [2.8.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.8.1...v2.8.2) (2026-02-19)


### Bug Fixes

* remove metro.config.js SVG rewrite that breaks build ([5cf7425](https://github.com/cloudpresser/react-native-opencode-client/commit/5cf742518c8d0977a1ae951221b3df1fccda5eb1))

## [2.8.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.8.0...v2.8.1) (2026-02-19)


### Bug Fixes

* add missing production-apk build profile to eas.json ([367ee31](https://github.com/cloudpresser/react-native-opencode-client/commit/367ee3179761dbafa4f73d1512f43c6ca210217e))

# [2.8.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.7.2...v2.8.0) (2026-02-19)


### Bug Fixes

* **eas-build:** update SLACK_MESSAGE formatting for better clarity ([3cca607](https://github.com/cloudpresser/react-native-opencode-client/commit/3cca60788fc1c9f9b858aa73d6994f9412f831a8))
* remove nonexistent lint/format scripts, switch release to local build, drop Slack ([b56ca1e](https://github.com/cloudpresser/react-native-opencode-client/commit/b56ca1e12c011cc3717ad3d193ef0b7b95a46176))


### Features

* add Discord webhook notifications for build success/failure ([02db3bf](https://github.com/cloudpresser/react-native-opencode-client/commit/02db3bf6d33df68173deac0d624248627d638aa3))

## [2.7.3](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.7.2...v2.7.3) (2026-02-19)


### Bug Fixes

* **eas-build:** update SLACK_MESSAGE formatting for better clarity ([3cca607](https://github.com/cloudpresser/react-native-opencode-client/commit/3cca60788fc1c9f9b858aa73d6994f9412f831a8))
* remove nonexistent lint/format scripts, switch release to local build, drop Slack ([b56ca1e](https://github.com/cloudpresser/react-native-opencode-client/commit/b56ca1e12c011cc3717ad3d193ef0b7b95a46176))

## [2.7.3](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.7.2...v2.7.3) (2026-02-19)


### Bug Fixes

* **eas-build:** update SLACK_MESSAGE formatting for better clarity ([3cca607](https://github.com/cloudpresser/react-native-opencode-client/commit/3cca60788fc1c9f9b858aa73d6994f9412f831a8))

## [2.7.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.7.1...v2.7.2) (2026-02-19)


### Bug Fixes

* add missing withNMSSHSimulatorFix plugin required by app.json ([5592c38](https://github.com/cloudpresser/react-native-opencode-client/commit/5592c38272983129e676ce3edd9f9f464232274a))

## [2.7.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.7.0...v2.7.1) (2026-02-19)


### Bug Fixes

* add expo-clipboard dependency for connection logs copy feature ([a6c6d4e](https://github.com/cloudpresser/react-native-opencode-client/commit/a6c6d4e165b4db12ea95173d61ca7f7a1402ea42))

# [2.7.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.6.1...v2.7.0) (2026-02-19)


### Features

* enhance connection logs with full request/response debug details ([1c19178](https://github.com/cloudpresser/react-native-opencode-client/commit/1c19178ca8614f038851ead471c1291ba3d15543))

## [2.6.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.6.0...v2.6.1) (2026-02-19)


### Bug Fixes

* add helpful error hint for iOS Simulator SSH limitation ([5575ff1](https://github.com/cloudpresser/react-native-opencode-client/commit/5575ff19a369f82c2b6509b779c750e781e1eb2d))

# [2.6.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.5.1...v2.6.0) (2026-02-19)


### Features

* add server connection logs with callback/sink pattern ([398db93](https://github.com/cloudpresser/react-native-opencode-client/commit/398db93771b0d798f44739fc8624b125f9d42f95))
* replace HTTP terminal with SSH terminal tab ([ca574c7](https://github.com/cloudpresser/react-native-opencode-client/commit/ca574c7c2499b356da1179a30f49a5352551ac64))

## [2.5.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.5.0...v2.5.1) (2026-02-18)


### Bug Fixes

* migrate all hardcoded colors to base16 theme tokens ([4451ed5](https://github.com/cloudpresser/react-native-opencode-client/commit/4451ed5a04df62108542634fc63e20a112aae7f0)), closes [#22c55e](https://github.com/cloudpresser/react-native-opencode-client/issues/22c55e) [282c34/#abb2bf](https://github.com/cloudpresser/react-native-opencode-client/issues/abb2bf) [#fff](https://github.com/cloudpresser/react-native-opencode-client/issues/fff) [#fff](https://github.com/cloudpresser/react-native-opencode-client/issues/fff) [#ef4444](https://github.com/cloudpresser/react-native-opencode-client/issues/ef4444)

# [2.5.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.4.1...v2.5.0) (2026-02-18)


### Features

* add base16 theming with build-time theme selection ([85566ad](https://github.com/cloudpresser/react-native-opencode-client/commit/85566ad9db148d5f0fa97a6d55d529150cffc755))

## [2.4.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.4.0...v2.4.1) (2026-02-18)


### Bug Fixes

* exclude duplicate OSGI manifest via expo-build-properties plugin ([59d19ac](https://github.com/cloudpresser/react-native-opencode-client/commit/59d19acb90dafd85052d07a549325f304a9e5b57))

# [2.4.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.3.1...v2.4.0) (2026-02-18)


### Features

* add markdown rendering, syntax-highlighted code blocks, tool call display, and agent selector to chat ([6d9672c](https://github.com/cloudpresser/react-native-opencode-client/commit/6d9672cf8a30e898b4a0b1d5c0373299733fd2ae))

## [2.3.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.3.0...v2.3.1) (2026-02-18)


### Bug Fixes

* convert API Unix timestamps to ISO strings for session and message dates ([fc7041a](https://github.com/cloudpresser/react-native-opencode-client/commit/fc7041a93768cd2d4a8641aaf15a665dd707ab7b))

# [2.3.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.2.3...v2.3.0) (2026-02-18)


### Features

* pre-load messages from server, add pull-to-refresh pagination ([93e2b7e](https://github.com/cloudpresser/react-native-opencode-client/commit/93e2b7ec647bf877cb51395ea3af149b88e9685d))

## [2.2.3](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.2.2...v2.2.3) (2026-02-18)


### Bug Fixes

* **ci:** separate stdout/stderr from EAS CLI to fix JSON parsing and pipefail exit code 5 ([382230c](https://github.com/cloudpresser/react-native-opencode-client/commit/382230c463acc5db929759462cfb283b0b204592))

## [2.2.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.2.1...v2.2.2) (2026-02-18)


### Bug Fixes

* **ci:** correct jq paths for EAS workflow JSON output and extract APK URL directly ([65a12b2](https://github.com/cloudpresser/react-native-opencode-client/commit/65a12b21a2a7d72903555294b866496cae52cbb8))

## [2.2.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.2.0...v2.2.1) (2026-02-18)


### Bug Fixes

* **ci:** remove maestro test job from EAS workflow (requires paid plan) ([ef6b211](https://github.com/cloudpresser/react-native-opencode-client/commit/ef6b211669ff5a2ac242606a016a9ddeded0edeb))

# [2.2.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.1.4...v2.2.0) (2026-02-18)


### Features

* **ci:** migrate to EAS Workflows with Maestro E2E tests ([1cfeff8](https://github.com/cloudpresser/react-native-opencode-client/commit/1cfeff86f21c29b1a842d0afdcaaab674cfa3d46))

## [2.1.4](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.1.3...v2.1.4) (2026-02-18)


### Bug Fixes

* **ci:** use yarn instead of npm ci in EAS Build workflow ([d8bfa1b](https://github.com/cloudpresser/react-native-opencode-client/commit/d8bfa1b28ec43307445d6cf88baa343741e55264))

## [2.1.3](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.1.2...v2.1.3) (2026-02-18)


### Bug Fixes

* **ci:** add .yarnrc ignore-engines and remove package-lock.json ([2221e93](https://github.com/cloudpresser/react-native-opencode-client/commit/2221e9369d9d185cfae9462b7ef7eb226ab5515d))
* **ci:** use yarn in Release workflow and add .easignore ([4b61a56](https://github.com/cloudpresser/react-native-opencode-client/commit/4b61a568a72cff83374c875f98247452ff7b3f4c))

## [2.1.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.1.1...v2.1.2) (2026-02-18)


### Bug Fixes

* **ci:** consolidate EAS build steps and capture build error output ([f452a46](https://github.com/cloudpresser/react-native-opencode-client/commit/f452a464dca7e411c0a5521a45ee08a6e34c9331))

## [2.1.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.1.0...v2.1.1) (2026-02-18)


### Bug Fixes

* **ci:** poll for EAS artifact URL before downloading APK ([7bf9f0a](https://github.com/cloudpresser/react-native-opencode-client/commit/7bf9f0a8b824a3a666a4546d4931e787e42e04af))

# [2.1.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.6...v2.1.0) (2026-02-18)


### Bug Fixes

* add testIDs and accessible props across all components for E2E testing ([9a54241](https://github.com/cloudpresser/react-native-opencode-client/commit/9a54241a86b3bc03b4af3524777ba61dd1030722))
* prevent port concatenation, double-tap save, and server/session dedup ([15c2282](https://github.com/cloudpresser/react-native-opencode-client/commit/15c228256b50a43d7752717209d0c259b14e3213))


### Features

* add new screens for session creation, git diff viewer, and theme hook ([1454879](https://github.com/cloudpresser/react-native-opencode-client/commit/14548793732d59fa79b98e9ec9a2bedef0d1dc8d))

## [2.0.6](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.5...v2.0.6) (2026-02-17)


### Bug Fixes

* use PAT for triggering EAS build workflow ([6641bed](https://github.com/cloudpresser/react-native-opencode-client/commit/6641bed502ea1c0c44216fdca9421b5fa5aa9165))

## [2.0.5](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.4...v2.0.5) (2026-02-17)


### Bug Fixes

* configure git auth for tag fetch in release workflow ([8501e97](https://github.com/cloudpresser/react-native-opencode-client/commit/8501e97b9495f1d5b69313c65d91b809bad99b48))
* trigger EAS build from release workflow after semantic-release creates tag ([760a207](https://github.com/cloudpresser/react-native-opencode-client/commit/760a20725cd7b5411f83a2a37605bdc6e13ba7d9))

## [2.0.4](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.3...v2.0.4) (2026-02-17)


### Bug Fixes

* improve error logging for session creation and Base64 encoding ([75cac9d](https://github.com/cloudpresser/react-native-opencode-client/commit/75cac9d9bf9b45538e5244fcc29f28460363864c))

## [2.0.3](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.2...v2.0.3) (2026-02-17)


### Bug Fixes

* use base-64 package for React Native compatibility ([7f1321f](https://github.com/cloudpresser/react-native-opencode-client/commit/7f1321f05fcbb817c734f649943c26ad3a5bc50b))

## [2.0.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.1...v2.0.2) (2026-02-16)


### Bug Fixes

* add contents write permission for GitHub release uploads ([155f604](https://github.com/cloudpresser/react-native-opencode-client/commit/155f604445ace281d407e572c6870ac20d3572fc))

## [2.0.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v2.0.0...v2.0.1) (2026-02-16)


### Bug Fixes

* remove react-native-document-picker causing Gradle build failure ([4ab1a5f](https://github.com/cloudpresser/react-native-opencode-client/commit/4ab1a5f1af261dc27bb66a2a08f0ffa919db38b5))

# [2.0.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v1.2.1...v2.0.0) (2026-02-16)


* feat!: replace Node.js SDK with React Native-compatible REST API ([94ff884](https://github.com/cloudpresser/react-native-opencode-client/commit/94ff8843355dc5cc5e020db01b8fbf737bfdc8eb))


### BREAKING CHANGES

* Removed ai-sdk-provider-opencode-sdk dependency and replaced with direct REST API calls to OpenCode server. The app now communicates directly with OpenCode servers without requiring Node.js-specific modules.

Changes:
- Remove ai-sdk-provider-opencode-sdk and ai packages
- Implement direct REST API calls using fetch
- Add react-native-sse for EventSource streaming
- Update all service methods for REST API compatibility
- Fix GitViewerTab to handle proper API response types
- Zero TypeScript errors, fully React Native compatible

## [1.2.1](https://github.com/cloudpresser/react-native-opencode-client/compare/v1.2.0...v1.2.1) (2026-02-16)


### Bug Fixes

* configure EAS to use local credentials for Android builds ([bf0f180](https://github.com/cloudpresser/react-native-opencode-client/commit/bf0f18010d97bfa8bbbdbbc73b75457e272c4c42))

# [1.2.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v1.1.0...v1.2.0) (2026-02-16)


### Features

* configure GitHub Actions to use Android keystore for signed APKs ([a301162](https://github.com/cloudpresser/react-native-opencode-client/commit/a3011621cc21b2f07341b433a03c32a9ea816fd9))

# [1.1.0](https://github.com/cloudpresser/react-native-opencode-client/compare/v1.0.2...v1.1.0) (2026-02-16)


### Features

* attach APK to GitHub releases and configure EAS credentials ([e8fab02](https://github.com/cloudpresser/react-native-opencode-client/commit/e8fab02347dbd4db6c80ddc7a625f782b06a4b04))

## [1.0.2](https://github.com/cloudpresser/react-native-opencode-client/compare/v1.0.1...v1.0.2) (2026-02-16)


### Bug Fixes

* add Android package name and iOS bundle identifier for EAS builds ([eaa3e60](https://github.com/cloudpresser/react-native-opencode-client/commit/eaa3e60e3de3d5097bd6f0fcbb6fc4c9b40ae73c))

# 1.0.0 (2026-02-16)


### Bug Fixes

* update GitHub Actions workflow to use Node.js 20 ([fb4d255](https://github.com/cloudpresser/react-native-opencode-client/commit/fb4d255573bf3e8308eb577a7df718d607a42bd9))
* update release workflow to use Node.js 22 for semantic-release compatibility ([44ee45c](https://github.com/cloudpresser/react-native-opencode-client/commit/44ee45c11e912e5eba55c7b25120e0e18409d9a9))


### Features

* add servers and sessions management screens ([f09ea19](https://github.com/cloudpresser/react-native-opencode-client/commit/f09ea195756f6d560f6dd42abe2dd070775edd0a))
* add TypeScript types and navigation structure ([3fd40eb](https://github.com/cloudpresser/react-native-opencode-client/commit/3fd40eb226dd0958f8822d0a588e2187c8f43f6f))
* configure root navigation with React Navigation ([0dfff9c](https://github.com/cloudpresser/react-native-opencode-client/commit/0dfff9c2743670842b018ded2d2d16992b20156e))
* configure semantic-release with tag-based versioning ([0a1ccf8](https://github.com/cloudpresser/react-native-opencode-client/commit/0a1ccf8755a04a8595cafd7e23f1249ab2874644))
* implement chat, git viewer, terminal, and file annotation tabs ([29ff367](https://github.com/cloudpresser/react-native-opencode-client/commit/29ff3675dbc317ee87150ce1d016b5bcbc6dda0c))
* implement Zustand store and OpenCode SDK integration ([9bb8bcc](https://github.com/cloudpresser/react-native-opencode-client/commit/9bb8bccbc9f3ba71e010947052ba3021649a8e5f))
