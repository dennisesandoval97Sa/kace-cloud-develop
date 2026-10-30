import { CustomError } from '../../../shared';

export class AttachmentStoragePort {
    /**
     * @param {Object} params
     * @param {string} params.emailId
     * @param {Buffer} params.buffer
     * @param {string} params.contentType
     * @param {string} params.filename
     */
    async upload(params) {
        throw new CustomError('Not implemented');
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     */
    async delete(key) {
        throw new CustomError('Not implemented');
    }

    /**
     * @param {string} key
     * @returns {Promise<{size: number, contentType: string|null}>}
     */
    async head(key) {
        throw new CustomError('Not implemented');
    }
}
