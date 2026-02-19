// This plugin excludes arm64 from simulator architectures on iOS
// to fix NMSSH build issues. No-op on Android.
const { withXcodeProject } = require("expo/config-plugins");

const withNMSSHSimulatorFix = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (
        typeof buildConfig === "object" &&
        buildConfig.buildSettings &&
        buildConfig.buildSettings.SDKROOT === '"iphonesimulator"'
      ) {
        buildConfig.buildSettings.EXCLUDED_ARCHS = '"arm64"';
      }
    }

    return config;
  });
};

module.exports = withNMSSHSimulatorFix;
