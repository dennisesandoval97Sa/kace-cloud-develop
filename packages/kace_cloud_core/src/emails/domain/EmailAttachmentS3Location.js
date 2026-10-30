const UUID_PREFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;
const ATTACHMENT_PATH_PATTERN = /^\/attachments\/([^/]+)\/([^/]+)$/;

/**
 * Parses S3 attachment URLs with the canonical key layout
 * `attachments/<folderId>/<attachmentUuid>_<filename>` produced by
 * S3AttachmentStorage and by the frontend upload flow.
 *
 * `folderId` is the second key segment: the email id for inbound
 * attachments, or the upload-flow folder id for outbound ones. It is
 * exactly the `id` that POST /download-s3-files expects.
 */
export class EmailAttachmentS3Location {
    /**
     * @param {string} url
     * @returns {{folderId: string, basename: string, cleanFilename: string, key: string}|null}
     */
    static fromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        let parsed;
        try {
            parsed = new URL(url);
        } catch {
            return null;
        }

        // Allows several segments after `s3` so dualstack/regional virtual-hosted
        // hosts match too (e.g. bucket.s3.dualstack.us-east-1.amazonaws.com).
        // Path-style hosts (bucket in the path) still degrade to null via the
        // attachments/<folderId>/<file> path pattern below.
        const isS3Host = /(^|\.)s3([.-][a-z0-9-]+)*\.amazonaws\.com$/i.test(parsed.hostname);
        if (!isS3Host) {
            return null;
        }

        const match = parsed.pathname.match(ATTACHMENT_PATH_PATTERN);
        if (!match) {
            return null;
        }

        let folderId, basename;
        try {
            folderId = decodeURIComponent(match[1]);
            basename = decodeURIComponent(match[2]);
        } catch {
            return null;
        }

        if (folderId.includes('/') || basename.includes('/')) {
            return null;
        }

        return {
            folderId,
            basename,
            cleanFilename: basename.replace(UUID_PREFIX_PATTERN, ''),
            key: `attachments/${folderId}/${basename}`,
        };
    }
}
