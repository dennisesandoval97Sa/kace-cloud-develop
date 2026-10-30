import { BaseController, HttpResponse, activeGroupScopeFromAuthenticatedUser } from '@kace/api-common';
import { AgentMoveDestinationFinder } from '@kace/core/src/interactions/application/bulk-mover/AgentMoveDestinationFinder.js';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { CustomError, Helper } from '@kace/core/src/shared/index.js';

export class AgentMoveDestinationsController extends BaseController {
    #event;
    #useCaseFactory;

    constructor(event, knexConfig, { useCaseFactory } = {}) {
        super(event, knexConfig);
        this.#event = event;
        this.repository = new KnexInteractionRepository(knexConfig);
        this.#useCaseFactory = useCaseFactory ?? (() => new AgentMoveDestinationFinder(this.repository));
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionIndex() {
        Helper.logInfo('Begin AgentMoveDestinations');
        try {
            if (!this.user.hasPermission('administrador', 'interactions', 'InteractionsUpdate')) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to move interactions.',
                    event: this.#event,
                });
            }

            const destinations = await this.#useCaseFactory().execute(
                this.pathParameters()?.id,
                activeGroupScopeFromAuthenticatedUser(this.user)
            );
            return HttpResponse.ok({ data: destinations, event: this.#event });
        } catch (error) {
            Helper.logError('AgentMoveDestinationsController error', error);
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.statusCode, this.#event);
            }
            return HttpResponse.internalServerError({ errors: error, event: this.#event });
        } finally {
            Helper.logInfo('End AgentMoveDestinations');
        }
    }
}
