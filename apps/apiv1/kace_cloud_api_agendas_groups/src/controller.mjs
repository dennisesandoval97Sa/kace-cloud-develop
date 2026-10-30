import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import {
    KnexAgendasGroupsRepository,
    AgendasGroupsCreator,
    AgendasGroupsSearcher,
    AgendasGroupsFinder,
    AgendasGroupsDeleter,
} from '@kace/core/src/agendas-groups/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { createSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

export class Controller extends BaseController {
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

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsCreate');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to create agenda-group relationships.',
                event: this.event,
            });
        }

        const payload = this.payload();
        const data = createSchema.validate(payload, { abortEarly: false });

        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            await new AgendasGroupsCreator(this.repository).execute(data.value);
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to view agenda-group relationships.',
                event: this.event,
            });
        }

        try {
            const agendasGroupsCollectionResponse = await new AgendasGroupsSearcher(this.repository).execute({});
            return HttpResponse.ok({
                ...agendasGroupsCollectionResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionIndex');
        }
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

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to search agenda-group relationships.',
                event: this.event,
            });
        }

        const { value, error } = SearchSchema.validate(this.payload(), {
            abortEarly: false,
        });

        if (error) {
            return HttpResponse.validationsFail({
                errors: error,
                event: this.event,
            });
        }

        try {
            const authorizedQuery = this.#authorizeSearch('agendas-groups.search', value);
            const agendasGroupsCollectionResponse = await new AgendasGroupsSearcher(this.repository).execute(
                authorizedQuery
            );
            return HttpResponse.ok({
                ...agendasGroupsCollectionResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read agenda-group relationships.',
                event: this.event,
            });
        }

        const agendaId = this.#getAgendaIdFromPath();
        const groupId = this.#getGroupIdFromPath();

        if (!this.validateId(agendaId) || !this.validateId(groupId)) {
            return HttpResponse.badRequest({
                message: 'Invalid id',
                event: this.event,
            });
        }

        const finderDto = {
            agenda_id: agendaId,
            group_id: groupId,
        };

        try {
            const AgendasGroupsResponse = await new AgendasGroupsFinder(this.repository).execute(finderDto);

            if (!AgendasGroupsResponse) {
                return HttpResponse.notFound({ event: this.event });
            }

            return HttpResponse.ok({
                ...AgendasGroupsResponse.toJson(),
                event: this.event,
            });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');

        const hasPermission = this.user.hasPermission('administrador', 'agendas-groups', 'AgendasGroupsDelete');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to delete agenda-group relationships.',
                event: this.event,
            });
        }

        const agendaId = this.#getAgendaIdFromPath();
        const groupId = this.#getGroupIdFromPath();

        if (!this.validateId(agendaId) || !this.validateId(groupId)) {
            return HttpResponse.badRequest({
                message: 'Invalid id',
                event: this.event,
            });
        }

        const deleteDto = {
            agenda_id: agendaId,
            group_id: groupId,
        };

        try {
            await new AgendasGroupsDeleter(this.repository).execute(deleteDto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return this.#handleError(error);
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    #getAgendaIdFromPath() {
        return this.pathParameters()?.agendaId;
    }

    #getGroupIdFromPath() {
        return this.pathParameters()?.groupId;
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
