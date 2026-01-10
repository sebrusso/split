/**
 * Expo Config Plugin for SplitFree iMessage Extension
 *
 * This plugin adds the iMessage extension target to the Xcode project,
 * configures App Groups for data sharing, and sets up the necessary
 * build settings.
 */

const {
  withXcodeProject,
  withInfoPlist,
  withEntitlementsPlist,
  IOSConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Extension bundle identifier suffix
const EXTENSION_NAME = "SplitFreeMessages";
const EXTENSION_BUNDLE_ID_SUFFIX = ".messages";

/**
 * Main plugin function
 */
function withIMessageExtension(config) {
  // Add App Groups entitlement to main app
  config = withAppGroupsEntitlement(config);

  // Add extension to Xcode project
  config = withMessagesExtensionTarget(config);

  return config;
}

/**
 * Add App Groups entitlement for data sharing between main app and extension
 */
function withAppGroupsEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    const bundleId = config.ios?.bundleIdentifier || "com.splitfree.app";
    const appGroupId = `group.${bundleId}`;

    config.modResults["com.apple.security.application-groups"] = [appGroupId];

    return config;
  });
}

/**
 * Add the iMessage extension target to the Xcode project
 */
function withMessagesExtensionTarget(config) {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const bundleId = config.ios?.bundleIdentifier || "com.splitfree.app";
    const extensionBundleId = `${bundleId}${EXTENSION_BUNDLE_ID_SUFFIX}`;
    const appGroupId = `group.${bundleId}`;
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, "ios");

    // Create extension directory
    const extensionPath = path.join(iosPath, EXTENSION_NAME);
    if (!fs.existsSync(extensionPath)) {
      fs.mkdirSync(extensionPath, { recursive: true });
    }

    // Copy Swift source files from our native directory to ios build
    const sourceDir = path.join(projectRoot, "native", EXTENSION_NAME);
    const swiftFiles = [
      "MessagesViewController.swift",
      "Models.swift",
      "SupabaseClient.swift",
      "Views.swift",
    ];

    // Copy source files from native/ to ios/ build directory
    for (const file of swiftFiles) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(extensionPath, file);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`[iMessage Extension] Copied: ${file}`);
      } else {
        console.warn(`[iMessage Extension] Source file missing: ${sourcePath}`);
      }
    }

    // Create Info.plist for extension
    const infoPlistContent = createExtensionInfoPlist(
      config.name || "SplitFree",
      extensionBundleId,
      config.version || "1.0.0",
      config.ios?.buildNumber || "1"
    );
    fs.writeFileSync(
      path.join(extensionPath, "Info.plist"),
      infoPlistContent,
      "utf8"
    );

    // Create entitlements file for extension
    const entitlementsContent = createExtensionEntitlements(appGroupId);
    fs.writeFileSync(
      path.join(extensionPath, `${EXTENSION_NAME}.entitlements`),
      entitlementsContent,
      "utf8"
    );

    // Add extension target to Xcode project
    const targetUuid = xcodeProject.generateUuid();
    const buildConfigurationListUuid = xcodeProject.generateUuid();
    const debugBuildConfigUuid = xcodeProject.generateUuid();
    const releaseBuildConfigUuid = xcodeProject.generateUuid();
    const mainGroupUuid = xcodeProject.generateUuid();
    const sourcesBuildPhaseUuid = xcodeProject.generateUuid();
    const resourcesBuildPhaseUuid = xcodeProject.generateUuid();
    const frameworksBuildPhaseUuid = xcodeProject.generateUuid();

    // Get project object
    const projectObject = xcodeProject.getFirstProject();
    const mainTargetUuid = projectObject.firstProject.mainGroup;

    // Create PBXGroup for extension files
    const extensionGroup = {
      isa: "PBXGroup",
      children: [],
      name: EXTENSION_NAME,
      path: EXTENSION_NAME,
      sourceTree: '"<group>"',
    };

    // Add Swift files to group
    const fileRefs = [];
    for (const file of swiftFiles) {
      const fileRefUuid = xcodeProject.generateUuid();
      xcodeProject.pbxFileReferenceSection()[fileRefUuid] = {
        isa: "PBXFileReference",
        lastKnownFileType: "sourcecode.swift",
        path: file,
        sourceTree: '"<group>"',
      };
      xcodeProject.pbxFileReferenceSection()[`${fileRefUuid}_comment`] = file;
      extensionGroup.children.push({
        value: fileRefUuid,
        comment: file,
      });
      fileRefs.push({ uuid: fileRefUuid, name: file });
    }

    // Add Info.plist to group
    const infoPlistRefUuid = xcodeProject.generateUuid();
    xcodeProject.pbxFileReferenceSection()[infoPlistRefUuid] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.xml",
      path: "Info.plist",
      sourceTree: '"<group>"',
    };
    extensionGroup.children.push({
      value: infoPlistRefUuid,
      comment: "Info.plist",
    });

    // Add entitlements to group
    const entitlementsRefUuid = xcodeProject.generateUuid();
    xcodeProject.pbxFileReferenceSection()[entitlementsRefUuid] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.entitlements",
      path: `${EXTENSION_NAME}.entitlements`,
      sourceTree: '"<group>"',
    };
    extensionGroup.children.push({
      value: entitlementsRefUuid,
      comment: `${EXTENSION_NAME}.entitlements`,
    });

    // Add group to project
    xcodeProject.pbxGroupByName("")[mainGroupUuid] = extensionGroup;
    xcodeProject.pbxGroupByName("")[`${mainGroupUuid}_comment`] = EXTENSION_NAME;

    // Add group to main project group
    const mainGroup = xcodeProject.pbxGroupByName("")["main"];
    if (mainGroup && mainGroup.children) {
      mainGroup.children.push({
        value: mainGroupUuid,
        comment: EXTENSION_NAME,
      });
    }

    // Create build configurations
    const commonBuildSettings = {
      CLANG_ENABLE_MODULES: "YES",
      CODE_SIGN_ENTITLEMENTS: `${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements`,
      CODE_SIGN_STYLE: "Automatic",
      INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/../../Frameworks"',
      PRODUCT_BUNDLE_IDENTIFIER: `"${extensionBundleId}"`,
      PRODUCT_NAME: `"$(TARGET_NAME)"`,
      SKIP_INSTALL: "YES",
      SWIFT_VERSION: "5.0",
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    const debugBuildSettings = {
      ...commonBuildSettings,
      DEBUG_INFORMATION_FORMAT: "dwarf",
      MTL_ENABLE_DEBUG_INFO: "INCLUDE_SOURCE",
      SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
    };

    const releaseBuildSettings = {
      ...commonBuildSettings,
      COPY_PHASE_STRIP: "NO",
      DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
      SWIFT_OPTIMIZATION_LEVEL: '"-O"',
    };

    // Create build configuration list
    if (!xcodeProject.pbxXCConfigurationList()) {
      xcodeProject.hash.project.objects["XCConfigurationList"] = {};
    }

    xcodeProject.pbxXCConfigurationList()[buildConfigurationListUuid] = {
      isa: "XCConfigurationList",
      buildConfigurations: [
        { value: debugBuildConfigUuid, comment: "Debug" },
        { value: releaseBuildConfigUuid, comment: "Release" },
      ],
      defaultConfigurationIsVisible: 0,
      defaultConfigurationName: "Release",
    };

    // Add build configurations
    if (!xcodeProject.pbxXCBuildConfigurationSection()) {
      xcodeProject.hash.project.objects["XCBuildConfiguration"] = {};
    }

    xcodeProject.pbxXCBuildConfigurationSection()[debugBuildConfigUuid] = {
      isa: "XCBuildConfiguration",
      buildSettings: debugBuildSettings,
      name: "Debug",
    };

    xcodeProject.pbxXCBuildConfigurationSection()[releaseBuildConfigUuid] = {
      isa: "XCBuildConfiguration",
      buildSettings: releaseBuildSettings,
      name: "Release",
    };

    // Create build phases
    // Sources build phase
    if (!xcodeProject.pbxSourcesBuildPhaseSection()) {
      xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] = {};
    }

    const sourceFiles = fileRefs.map((ref) => ({
      value: xcodeProject.generateUuid(),
      comment: `${ref.name} in Sources`,
    }));

    xcodeProject.pbxSourcesBuildPhaseSection()[sourcesBuildPhaseUuid] = {
      isa: "PBXSourcesBuildPhase",
      buildActionMask: 2147483647,
      files: sourceFiles,
      runOnlyForDeploymentPostprocessing: 0,
    };

    // Add build file references
    if (!xcodeProject.pbxBuildFileSection()) {
      xcodeProject.hash.project.objects["PBXBuildFile"] = {};
    }

    sourceFiles.forEach((sourceFile, index) => {
      xcodeProject.pbxBuildFileSection()[sourceFile.value] = {
        isa: "PBXBuildFile",
        fileRef: fileRefs[index].uuid,
      };
    });

    // Resources build phase (empty for now)
    if (!xcodeProject.pbxResourcesBuildPhaseSection()) {
      xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] = {};
    }

    xcodeProject.pbxResourcesBuildPhaseSection()[resourcesBuildPhaseUuid] = {
      isa: "PBXResourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };

    // Frameworks build phase
    if (!xcodeProject.pbxFrameworksBuildPhaseSection()) {
      xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] = {};
    }

    xcodeProject.pbxFrameworksBuildPhaseSection()[frameworksBuildPhaseUuid] = {
      isa: "PBXFrameworksBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };

    // Create extension product reference
    const productRefUuid = xcodeProject.generateUuid();
    xcodeProject.pbxFileReferenceSection()[productRefUuid] = {
      isa: "PBXFileReference",
      explicitFileType: '"wrapper.app-extension"',
      includeInIndex: 0,
      path: `${EXTENSION_NAME}.appex`,
      sourceTree: "BUILT_PRODUCTS_DIR",
    };

    // Create native target
    if (!xcodeProject.pbxNativeTargetSection()) {
      xcodeProject.hash.project.objects["PBXNativeTarget"] = {};
    }

    xcodeProject.pbxNativeTargetSection()[targetUuid] = {
      isa: "PBXNativeTarget",
      buildConfigurationList: buildConfigurationListUuid,
      buildPhases: [
        { value: sourcesBuildPhaseUuid, comment: "Sources" },
        { value: frameworksBuildPhaseUuid, comment: "Frameworks" },
        { value: resourcesBuildPhaseUuid, comment: "Resources" },
      ],
      buildRules: [],
      dependencies: [],
      name: `"${EXTENSION_NAME}"`,
      productName: `"${EXTENSION_NAME}"`,
      productReference: productRefUuid,
      productType: '"com.apple.product-type.app-extension.messages"',
    };
    xcodeProject.pbxNativeTargetSection()[`${targetUuid}_comment`] = EXTENSION_NAME;

    // Add target to project
    const project = xcodeProject.pbxProjectSection()[projectObject.uuid];
    if (project && project.targets) {
      project.targets.push({
        value: targetUuid,
        comment: EXTENSION_NAME,
      });
    }

    // Add embed extension build phase to main target
    const embedExtensionPhaseUuid = xcodeProject.generateUuid();
    const embedBuildFileUuid = xcodeProject.generateUuid();

    // Create copy files build phase for embedding
    if (!xcodeProject.pbxCopyFilesBuildPhaseSection()) {
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] = {};
    }

    xcodeProject.pbxCopyFilesBuildPhaseSection()[embedExtensionPhaseUuid] = {
      isa: "PBXCopyFilesBuildPhase",
      buildActionMask: 2147483647,
      dstPath: '""',
      dstSubfolderSpec: 13, // PlugIns folder
      files: [{ value: embedBuildFileUuid, comment: `${EXTENSION_NAME}.appex in Embed App Extensions` }],
      name: '"Embed App Extensions"',
      runOnlyForDeploymentPostprocessing: 0,
    };

    // Add build file for embedding
    xcodeProject.pbxBuildFileSection()[embedBuildFileUuid] = {
      isa: "PBXBuildFile",
      fileRef: productRefUuid,
      settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
    };

    // Add dependency
    const dependencyUuid = xcodeProject.generateUuid();
    const containerItemProxyUuid = xcodeProject.generateUuid();

    if (!xcodeProject.pbxContainerItemProxySection()) {
      xcodeProject.hash.project.objects["PBXContainerItemProxy"] = {};
    }

    xcodeProject.pbxContainerItemProxySection()[containerItemProxyUuid] = {
      isa: "PBXContainerItemProxy",
      containerPortal: projectObject.uuid,
      proxyType: 1,
      remoteGlobalIDString: targetUuid,
      remoteInfo: `"${EXTENSION_NAME}"`,
    };

    if (!xcodeProject.pbxTargetDependencySection()) {
      xcodeProject.hash.project.objects["PBXTargetDependency"] = {};
    }

    xcodeProject.pbxTargetDependencySection()[dependencyUuid] = {
      isa: "PBXTargetDependency",
      target: targetUuid,
      targetProxy: containerItemProxyUuid,
    };

    // Find main app target and add dependency and embed phase
    const targets = xcodeProject.pbxNativeTargetSection();
    for (const key of Object.keys(targets)) {
      if (key.endsWith("_comment")) continue;
      const target = targets[key];
      if (
        target &&
        target.productType === '"com.apple.product-type.application"'
      ) {
        // Add dependency
        if (!target.dependencies) {
          target.dependencies = [];
        }
        target.dependencies.push({
          value: dependencyUuid,
          comment: "PBXTargetDependency",
        });

        // Add embed phase
        if (!target.buildPhases) {
          target.buildPhases = [];
        }
        target.buildPhases.push({
          value: embedExtensionPhaseUuid,
          comment: "Embed App Extensions",
        });
        break;
      }
    }

    console.log(
      `[iMessage Extension] Added ${EXTENSION_NAME} target with bundle ID: ${extensionBundleId}`
    );

    return config;
  });
}

/**
 * Create Info.plist content for the extension
 */
function createExtensionInfoPlist(
  appName,
  bundleId,
  version,
  buildNumber
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>${appName}</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${buildNumber}</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.message-payload-provider</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).MessagesViewController</string>
    </dict>
</dict>
</plist>
`;
}

/**
 * Create entitlements content for the extension
 */
function createExtensionEntitlements(appGroupId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${appGroupId}</string>
    </array>
</dict>
</plist>
`;
}

module.exports = withIMessageExtension;
