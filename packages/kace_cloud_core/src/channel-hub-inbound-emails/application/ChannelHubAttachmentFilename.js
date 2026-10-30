const LONG_CHANNEL_HUB_FILENAME_PREFIX_THRESHOLD = 150;
const FILE_EXTENSION_PATTERN = /\.[a-z0-9]{1,20}$/i;

export function extractChannelHubOriginalFilename(filename) {
    const value = typeof filename === 'string' ? filename : '';
    const lastUnderscoreIndex = value.lastIndexOf('_');

    if (lastUnderscoreIndex === -1) {
        return value;
    }

    const prefix = value.slice(0, lastUnderscoreIndex);
    const suffix = value.slice(lastUnderscoreIndex + 1);

    if (prefix.length > LONG_CHANNEL_HUB_FILENAME_PREFIX_THRESHOLD && FILE_EXTENSION_PATTERN.test(suffix)) {
        return suffix;
    }

    return value;
}
