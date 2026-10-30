import { BaseController, HttpResponse } from '@kace/api-common';
import {
    KnexAgendasGroupsRepository,
    AgendasGroupsBatchDeleter,
    AgendasGroupsBatchCreator,
} from '@kace/core/src/agendas-groups/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { batchSchema } from './schemas.mjs';

export class CustomController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexAgendasGroupsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreateBatch() {
        Helper.logInfo('Begin actionCreateBatch');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsBatchCreate');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to create agenda-group relationships in batch.',
                event: this.event,
            });
        }

        const payload = this.payload();
        const data = batchSchema.validate(payload, { abortEarly: false });

        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            await new AgendasGroupsBatchCreator(this.repository).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionCreateBatch');
        }
    }

    async actionDeleteBatch() {
        Helper.logInfo('Begin actionDeleteBatch');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsBatchDelete');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to delete agenda-group relationships in batch.',
                event: this.event,
            });
        }

        const payload = this.payload();
        const data = batchSchema.validate(payload, { abortEarly: false });

        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            await new AgendasGroupsBatchDeleter(this.repository).execute(data.value);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionDeleteBatch');
        }
    }

    /**
     * @override BaseController.run
     */
    async run() {
        try {
            this.user = await this.getLoggedInUser();
            return await this.#newActions();
        } finally {
            await this.repository.destroyConnection();
        }
    }

    /**
     * @override BaseController.runCognitoAuth
     */
    async runCognitoAuth() {
        try {
            return await this.#newActions();
        } finally {
            await this.repository.destroyConnection();
        }
    }

    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            POST: {
                '/batch': this.actionCreateBatch,
                '/batch/delete': this.actionDeleteBatch,
            },
        };

        const action = resourceActions[method]?.[resource];

        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        }

        return HttpResponse.methodNotAllowed();
    }

    resource() {
        return this.event.resource;
    }

    #handleError(error) {
        const { statusCode = 500 } = error;

        if (statusCode === 400) {
            return HttpResponse.badRequest({ errors: error, event: this.event });
        }

        if (statusCode === 404) {
            return HttpResponse.notFound({ errors: error, event: this.event });
        }

        return HttpResponse.internalServerError({
            errors: error,
            event: this.event,
        });
    }
}
