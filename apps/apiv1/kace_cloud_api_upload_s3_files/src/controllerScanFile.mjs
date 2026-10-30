import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { S3FileScanner } from '@kace/core/src/s3-files/application/scan/S3FileScanner';
import { S3ScanService } from '@kace/core/src/s3-files/infrastructure/external/S3ScanService';
import { Helper } from '@kace/core/src/shared/index.js';
import { validateScanFileSchema } from './schemas.mjs';

export class ControllerScanFile extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.s3FileScanner = new S3FileScanner(new S3ScanService());
    }

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');

        try {
            const payload = this.payload();
            const { value, error } = validateScanFileSchema.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('upload-s3-files.scan-file.search', value);
            const responseScan = await this.s3FileScanner.execute(authorizedQuery);

            return HttpResponse.ok({
                message: responseScan.message,
                errors: responseScan.errors || null,
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
