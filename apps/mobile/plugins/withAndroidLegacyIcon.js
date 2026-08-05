const fs = require("fs");
const path = require("path");

const { withDangerousMod } = require("expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");

const LEGACY_BASELINE_PIXEL_SIZE = 48;
const ANDROID_RES_PATH = "android/app/src/main/res";
const DPI_SCALES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function writeLegacyIconAsync(
    projectRoot,
    src,
    { fileName, cacheType, borderRadiusRatio },
) {
    await Promise.all(
        Object.entries(DPI_SCALES).map(async ([dpi, scale]) => {
            const size = LEGACY_BASELINE_PIXEL_SIZE * scale;
            const { source } = await generateImageAsync(
                { projectRoot, cacheType },
                {
                    src,
                    width: size,
                    height: size,
                    resizeMode: "cover",
                    backgroundColor: "transparent",
                    borderRadius: borderRadiusRatio
                        ? size * borderRadiusRatio
                        : undefined,
                },
            );
            const dpiFolder = path.resolve(
                projectRoot,
                ANDROID_RES_PATH,
                `mipmap-${dpi}`,
            );
            await fs.promises.mkdir(dpiFolder, { recursive: true });
            await fs.promises.writeFile(
                path.resolve(dpiFolder, fileName),
                source,
            );
        }),
    );
}

module.exports = function withAndroidLegacyIcon(config, props = {}) {
    const src = props.icon ?? config.android?.icon ?? config.icon;
    if (!src) {
        return config;
    }
    return withDangerousMod(config, [
        "android",
        async (config) => {
            const { projectRoot } = config.modRequest;
            await writeLegacyIconAsync(projectRoot, src, {
                fileName: "ic_launcher.webp",
                cacheType: "android-legacy-square-icon",
            });
            await writeLegacyIconAsync(projectRoot, src, {
                fileName: "ic_launcher_round.webp",
                cacheType: "android-legacy-round-icon",
                borderRadiusRatio: 0.5,
            });
            return config;
        },
    ]);
};
