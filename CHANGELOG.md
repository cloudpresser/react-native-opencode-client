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
