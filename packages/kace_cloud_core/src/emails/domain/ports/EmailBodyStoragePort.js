import { CustomError } from '../../../shared';

export class EmailBodyStoragePort {
    async upload(_params) {
        throw new CustomError('Not implemented');
    }

    async download(_s3Key) {
        throw new CustomError('Not implemented');
    }

    async head(_s3Key) {
        throw new CustomError('Not implemented');
    }

    async delete(_s3Key) {
        throw new CustomError('Not implemented');
    }
}
