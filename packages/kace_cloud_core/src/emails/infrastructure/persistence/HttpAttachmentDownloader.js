import { CustomError } from '../../../shared';
import { AttachmentDownloaderPort } from '../../domain/ports/AttachmentDownloaderPort';

/**
 * HTTP-based implementation of the AttachmentDownloaderPort.
 *
 * This class is responsible for downloading attachments from a remote HTTP/HTTPS
 * endpoint and converting the response into a format suitable for further processing
 * or storage (e.g., uploading to S3).
 */
export class HttpAttachmentDownloader extends AttachmentDownloaderPort {
    /**
     * Downloads an attachment from a remote URL.
     *
     * @param {string} url - Public HTTP or HTTPS URL of the attachment.
     *
     * @returns {Promise<{ buffer: Buffer, contentType: string | null, filename: string | undefined }>}
     * An object containing:
     * - buffer: The file content as a Buffer
     * - contentType: MIME type provided by the server (if available)
     * - filename: Filename is best-effort: extracted from Content-Disposition when available, otherwise inferred from URL. Final safety is enforced by Filename.sanitize.
     *
     *
     * @throws {CustomError} When the request fails, the response is not successful,
     * or the file cannot be processed.
     */
    async download(url) {
        if (!url) {
            throw new CustomError('Attachment download URL is required', 400);
        }

        let response;

        try {
            response = await fetch(url);
        } catch (error) {
            throw new CustomError(`Failed to download attachment. Network error while accessing URL: ${url}`, 502);
        }

        if (!response.ok) {
            throw new CustomError(
                `Failed to download attachment. HTTP status ${response.status} (${response.statusText}) for URL: ${url}`,
                502
            );
        }

        let buffer;
        try {
            buffer = Buffer.from(await response.arrayBuffer());
        } catch (error) {
            throw new CustomError(`Failed to process attachment content from URL: ${url}`, 422);
        }

        return {
            buffer,
            contentType: response.headers.get('content-type'),
            filename: this.#extractFilename(url, response),
        };
    }

    /**
     * Extracts the filename from the HTTP response or URL.
     *
     * Priority:
     * 1. Content-Disposition header (if present)
     * 2. URL path segment
     *
     * @param {string} url - Original download URL.
     * @param {Response} response - Fetch API response object.
     *
     * @returns {string | undefined} The extracted filename.
     */
    #extractFilename(url, response) {
        const contentDisposition = response?.headers.get('content-disposition');

        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match?.[1]) {
                return match[1];
            }
        }

        return url?.split('/').pop();
    }
}
