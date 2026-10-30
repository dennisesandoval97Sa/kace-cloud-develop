import { BaseController, HttpResponse, Response, activeGroupScopeFromAuthenticatedUser } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { InteractionReviewClaimer } from '@kace/core/src/interactions/application/review/InteractionReviewClaimer';
import { InteractionReviewReleaser } from '@kace/core/src/interactions/application/review/InteractionReviewReleaser';

function errorResponse(error, event) {
    const message = error?.message ?? 'Unexpected error occurred';
    const statusCode = error?.statusCode;
    const safeError = { message, statusCode };

    if (statusCode === 400) {
        return HttpResponse.badRequest({ message, errors: safeError, event });
    }
    if (statusCode === 403) {
        return HttpResponse.forbidden({ message, event });
    }
    if (statusCode === 404) {
        return HttpResponse.notFound({ message, event });
    }
    if (statusCode === 409) {
        return new Response({ message, statusCode: 409, errors: safeError, event });
    }

    return HttpResponse.internalServerError({
        errors: error,
        event,
    });
}

function hasPermission(user, role, moduleId, permission) {
    try {
        return Boolean(user?.hasPermission?.(role, moduleId, permission));
    } catch {
        return false;
    }
}

const isAgentReviewResource = (resource) => resource?.startsWith('/agent/{id}/review/');

export class ControllerReview extends BaseController {
    #event;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexInteractionRepository(knexConfig);
        this.#event = event;
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin action Interaction Review');
        try {
            const id = this.pathParameters()?.id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.#event,
                });
            }

            const resource = this.#event.originalResource ?? this.#event.resource;
            const scope = isAgentReviewResource(resource) ? activeGroupScopeFromAuthenticatedUser(this.user) : null;
            const canManage =
                hasPermission(this.user, 'administrador', 'interactions', 'InteractionsUpdate') ||
                hasPermission(this.user, 'agente', 'interactions', 'InteractionsCreate');

            if (resource === '/{id}/review/claim' || resource === '/agent/{id}/review/claim') {
                if (!canManage) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to manage interaction review.',
                        event: this.#event,
                    });
                }

                const claimer = new InteractionReviewClaimer(this.repository, this.user);
                const response = scope ? await claimer.execute(id, scope) : await claimer.execute(id);
                return HttpResponse.ok({ data: response.data, event: this.#event });
            }

            if (resource === '/{id}/review/release' || resource === '/agent/{id}/review/release') {
                // Intentional controller-level bypass: InteractionReviewReleaser enforces owner-or-admin release authorization.
                const releaser = new InteractionReviewReleaser(this.repository, this.user);
                const response = scope ? await releaser.execute(id, scope) : await releaser.execute(id);
                return HttpResponse.ok({ data: response.data, event: this.#event });
            }

            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.#event,
            });
        } catch (error) {
            Helper.logError(error);
            return errorResponse(error, this.#event);
        } finally {
            Helper.logInfo('End action Interaction Review');
        }
    }
}
