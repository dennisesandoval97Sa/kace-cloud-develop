import { BaseController, HttpResponse, activeGroupScopeFromAuthenticatedUser } from '@kace/api-common';
import { InteractionBulkCloser } from '@kace/core/src/interactions/application/bulk-closer/InteractionBulkCloser.js';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { KnexLiteralRepository } from '@kace/core/src/literals/infrastructure/persistence/KnexLiteralRepository.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import { schemaBulkClose } from './schemas.mjs';

export class BulkCloseController extends BaseController {
    #event;
    #useCaseFactory;

    constructor(event, knexConfig, { useCaseFactory } = {}) {
        super(event, knexConfig);
        this.#event = event;
        this.repository = new KnexInteractionRepository(knexConfig);
        this.literalRepository = new KnexLiteralRepository(this.repository.connection);
        this.#useCaseFactory =
            useCaseFactory ?? (() => new InteractionBulkCloser(this.repository, this.literalRepository, this.user));
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin InteractionsBulkClose');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsBulkClose');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to close interactions.',
                    event: this.#event,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaBulkClose.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }

            const isAgentRoute = (this.#event.originalResource ?? this.#event.resource) === '/agent/close';
            const useCase = this.#useCaseFactory();
            const result = isAgentRoute
                ? await useCase.execute(value, activeGroupScopeFromAuthenticatedUser(this.user))
                : await useCase.execute(value);

            return HttpResponse.ok({ data: result, event: this.#event });
        } catch (error) {
            Helper.logError('BulkCloseController error', error);
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.statusCode, this.#event);
            }
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End InteractionsBulkClose');
        }
    }
}
