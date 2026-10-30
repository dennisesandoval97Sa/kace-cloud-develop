import {
    BaseController,
    HttpResponse,
    SearchAuthorizationError,
    SearchAuthorizationService,
    SearchSchema,
} from '@kace/api-common';
import { KnexSchemasRepository } from '@kace/core/src/schemas/infrastructure/persistence/KnexSchemasRepository';
import { SchemaRules } from '@kace/core/src/schemas/application/rules/SchemaRules';
import { SchemaRulesSearcher } from '@kace/core/src/schemas/application/rules/SchemaRulesSearcher';
import { Helper } from '@kace/core/src/shared/index.js';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { VOTableName } from '@kace/core/src/aux_definitions/domain/VOTableName';

export class ControllerRules extends BaseController {
    /**
     * @type {KnexAuxDefinitionsRepository}
     */
    #auxDefinitionsRepository;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexSchemasRepository(this.database_connection);
        this.started_at = new Date();
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.database_connection);
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'schemas', 'SchemasRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            let response = null;
            const id = this.pathParameters().id;
            Helper.logDebug('Action read id: ' + id);
            if (this.validateId(id)) {
                response = await new SchemaRules(this.repository).execute(id);
            } else {
                const auxDefinition = await this.#auxDefinitionsRepository.findByTableName(new VOTableName(id));
                if (auxDefinition) {
                    response = await new SchemaRules(this.repository).execute(auxDefinition.schema_id.value);
                } else {
                    return HttpResponse.badRequest({
                        message: 'Invalid id',
                        event: this.event,
                    });
                }
            }

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
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
        Helper.logInfo('Begin actionSearch rules');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'schemas', 'SchemasRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const authorizedQuery = this.#authorizeSearch('schemas.rules.search', data.value);
            const response = await new SchemaRulesSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch rules');
        }
    }
}
