// This plugin excludes arm64 from iOS simulator architectures
// to fix NMSSH's device-only OpenSSL static libraries.
const { withXcodeProject } = require("expo/config-plugins");

const withNMSSHSimulatorFix = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    xcodeProject.addBuildProperty('"EXCLUDED_ARCHS[sdk=iphonesimulator*]"', '"arm64"');

    return config;
  });
};

module.exports = withNMSSHSimulatorFix;
