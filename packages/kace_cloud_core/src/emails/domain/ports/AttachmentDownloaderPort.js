import { CustomError } from '../../../shared';

export class AttachmentDownloaderPort {
    /**
     * @param {string} url
     * @returns {Promise<{ buffer: Buffer, contentType: string, filename: string }>}
     */
    async download(url) {
        throw new CustomError('Not implemented');
    }
}
