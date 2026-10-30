import { HelpsCreateSchema, HelpsUpdateSchema } from './HelpsSchema.mjs';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    HelpsCreator,
    HelpsDeleter,
    HelpsFinder,
    HelpsUpdater,
    HelpsSearcher,
    KnexHelpsRepository,
} from '@kace/core/src/helps';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';
import { HelpsAttachmentsSearcher, KnexHelpsAttachmentsRepository } from '@kace/core/src/helps_attachments';
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        /*
         * Pass CONFIG objects (not this.database_connection, a built Knex instance —
         * that would collapse the reader onto the writer, §8.1 footgun). Both repos read.
         */
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexHelpsRepository(knexConfig, readerConfig);
        this.helpsAttachmentsRepository = new KnexHelpsAttachmentsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await this.helpsAttachmentsRepository.destroyConnection();
        await super.destroyDbConnection();
    }

    async #bindAttachments(helps) {
        const responseAttachments = await new HelpsAttachmentsSearcher(this.helpsAttachmentsRepository).execute({
            filter: [
                {
                    field: 'help_id',
                    operator: 'in',
                    value: helps.map((help) => help.id).join(', '),
                    type: 'AND',
                },
            ],
        });
        return helps.map((help) => {
            return {
                ...help,
                attachments: responseAttachments
                    .toJson()
                    .data.items.filter((attachment) => attachment.help_id === help.id),
            };
        });
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help', 'HelpsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 30,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            const responseHelps = await new HelpsSearcher(this.repository).execute(dtoCriteria);
            const helps = responseHelps.toJson();
            helps.data.items = await this.#bindAttachments(responseHelps.toJson().data.items);
            return HttpResponse.ok({ ...helps, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help', 'HelpsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const responseHelp = await new HelpsFinder(this.repository).execute(id);
            const helpWithAttachment = await this.#bindAttachments([responseHelp.toJson().data]);

            return HttpResponse.ok({
                data: helpWithAttachment[0],
                event: this.event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help', 'HelpsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /helps',
                resourceType: 'helps',
                repository: this.repository,
            });

            const data = HelpsCreateSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const savedHelp = await new HelpsCreator(this.repository).execute(data.value);
            return HttpResponse.created({ data: { id: savedHelp.id.value }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help', 'HelpsDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }
            const dto = {
                deleted_at: new Date(),
                deleted_by: this.user.id.value,
            };
            await new HelpsDeleter(this.repository).execute(id, dto);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'help', 'HelpsUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.updated_by = this.user.id.value;
            payload.updated_at = new Date();
            const data = HelpsUpdateSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new HelpsUpdater(this.repository).execute(data.value, id);
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
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
        Helper.logInfo('End actionSearch');
        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'help', 'HelpsRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'help', 'HelpsReadAgent');
            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const data = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            const authorizedQuery = this.#authorizeSearch('helps.search', data.value);
            const responseHelps = await new HelpsSearcher(this.repository).execute(authorizedQuery);
            const helps = responseHelps.toJson();
            helps.data.items = await this.#bindAttachments(responseHelps.toJson().data.items);
            return HttpResponse.ok({ ...helps, event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
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
