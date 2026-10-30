import { BaseController, HttpResponse, activeGroupScopeFromAuthenticatedUser } from '@kace/api-common';
import { InteractionBulkMover } from '@kace/core/src/interactions/application/bulk-mover/InteractionBulkMover.js';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { CustomError, Helper, ValidationFailError } from '@kace/core/src/shared/index.js';
import { schemaBulkMove } from './schemas.mjs';

export class BulkMoveController extends BaseController {
    #event;
    #useCaseFactory;

    constructor(event, knexConfig, { useCaseFactory } = {}) {
        super(event, knexConfig);
        this.#event = event;
        this.repository = new KnexInteractionRepository(knexConfig);
        this.#useCaseFactory = useCaseFactory ?? (() => new InteractionBulkMover(this.repository, this.user));
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin InteractionsBulkMove');
        try {
            const isAgentRoute = (this.#event.originalResource ?? this.#event.resource) === '/agent/move';
            const permission = isAgentRoute ? 'InteractionsUpdate' : 'InteractionsBulkMove';
            const hasPermission = this.user.hasPermission('administrador', 'interactions', permission);
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to move interactions.',
                    event: this.#event,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaBulkMove.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }

            const useCase = this.#useCaseFactory();
            const result = isAgentRoute
                ? await useCase.execute(value, activeGroupScopeFromAuthenticatedUser(this.user))
                : await useCase.execute(value);

            return HttpResponse.ok({ data: result, event: this.#event });
        } catch (error) {
            Helper.logError('BulkMoveController error', error);
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
            Helper.logInfo('End InteractionsBulkMove');
        }
    }
}
