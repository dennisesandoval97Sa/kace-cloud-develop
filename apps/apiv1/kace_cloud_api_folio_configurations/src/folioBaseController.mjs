import { BaseController, HttpResponse, Response, SearchAuthorizationError } from '@kace/api-common';
import { objectIdentityErrorResponse } from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { KnexFolioConfigurationRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '@kace/core/src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { BaseError } from '@kace/core/src/shared/errors/BaseError.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';

export const MODULE = 'folio-configurations';

/**
 * Shared by the controller of each endpoint of the service: the two repositories, their
 * pools and the error mapping. Routing stays in handler.mjs and BaseController.run().
 */
export class FolioBaseController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        /*
         * Pass CONFIG objects (not this.database_connection, a built Knex instance —
         * that would collapse the reader onto the writer, §8.1 footgun).
         */
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexFolioConfigurationRepository(knexConfig, readerConfig);
        this.sequenceRepository = new KnexFolioSequenceRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        /*
         * Both repositories were built from config objects, so each owns a pool. Missing the
         * sequence one leaks a connection on every /preview call, which is the endpoint the
         * configuration screen polls while it is open.
         */
        await this.repository.destroyConnection();
        await this.sequenceRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    /**
     * setDefaultResources still mounts /advance-search and /{id}/history in API Gateway. The
     * inherited actions check users:UsersRead and run a free-form search that skips the
     * folio-configurations.search policy, so this service answers 404 to both.
     */
    async actionAdvanceSearch() {
        return HttpResponse.notFound({ message: 'Resource not found: /advance-search', event: this.event });
    }

    async actionHistory() {
        return HttpResponse.notFound({ message: 'Resource not found: /{id}/history', event: this.event });
    }

    forbidden(verb) {
        return HttpResponse.forbidden({
            message: `You do not have permission to ${verb} this resource.`,
            event: this.event,
        });
    }

    /**
     * Domain errors keep their own status code (404 unknown id, 409 counter contention,
     * 400 invalid configuration), and their message travels as publicData: in production
     * Response replaces the message of a 4xx with a generic one.
     */
    fail(error) {
        if (error instanceof SearchAuthorizationError) {
            return HttpResponse.forbidden({ message: error.message, event: this.event });
        }

        const identityResponse = objectIdentityErrorResponse(error, this.event);
        if (identityResponse) return identityResponse;

        if (error instanceof BaseError && error.statusCode >= 400 && error.statusCode < 500) {
            Helper.logInfo(error);
            return new Response({
                message: error.message,
                statusCode: error.statusCode,
                errors: error,
                event: this.event,
                publicData: { detail: error.message },
            });
        }

        Helper.logError('folio-configurations action failed', error);
        return HttpResponse.internalServerError({ errors: error, event: this.event });
    }
}
