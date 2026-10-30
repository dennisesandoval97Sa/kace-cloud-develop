import { createSchema, updateSchema } from './schemas.mjs';
import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import {
    TransitionCreator,
    TransitionFinder,
    TransitionSearcher,
    TransitionUpdater,
    KnexTransitionsRepository,
} from '@kace/core/src/transition';
import { StateFinder, KnexStateRepository } from '@kace/core/src/state/index.js';
import { FlowFinder, KnexFlowRepository } from '@kace/core/src/flow/index.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects (not this.database_connection, a built Knex instance —
        // that would collapse the reader onto the writer, §8.1 footgun).
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexTransitionsRepository(knexConfig, readerConfig);
        // State/Flow repos only enrich actionRead and are shared with other write-paths; keep writer.
        this.stateRepository = new KnexStateRepository(this.database_connection);
        this.flowRepository = new KnexFlowRepository(this.database_connection);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'transitions', 'TransitionsCreate');
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
                endpoint: 'POST /transitions',
                resourceType: 'transitions',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const states = data.value.states;

            // Nota: `is_visible` viene de `state.is_visible` (validado por Joi en el schema).
            // En el JSON del flujo (ReactFlow), este valor se almacena como `data.is_visible`
            // dentro del edge. Al persistir, se mapea a la columna `is_visible` de la tabla `transiciones`.
            for (const state of states) {
                const transitionPayload = {
                    id: state.id,
                    estado_actual_id: state.estado_actual_id,
                    siguiente_estado_id: state.siguiente_estado_id,
                    ans_id: state.ans_id,
                    rule_id: state.rule_id,
                    flujo_id: data.value.flujo_id,
                    status: data.value.status,
                    is_visible: state.is_visible,
                    created_at: data.value.created_at,
                    created_by: data.value.created_by,
                    updated_at: data.value.created_at,
                    updated_by: data.value.created_by,
                };
                await new TransitionCreator(this.repository).execute(transitionPayload);
            }
            return HttpResponse.created({ event: this.event });
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

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'transitions', 'TransitionsUpdate');
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
            payload.updated_at = new Date().toISOString();
            payload.updated_by = this.user.id.value;

            const data = updateSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new TransitionUpdater(this.repository).execute(data.value, id);
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

    async actionRead() {
        Helper.logInfo('Begin actionRead');

        try {
            const hasPermission = this.user.hasPermission('administrador', 'transitions', 'TransitionsRead');
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

            const transition = await new TransitionFinder(this.repository).execute(id);
            if (!transition) {
                return HttpResponse.notFound({
                    message: 'Transition not found',
                    event: this.event,
                });
            }

            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            // TODO: Refactorizar Transition añadir las entidades estados y flujo
            const data = transition.toJson().data;
            let currentState = null;
            if (data.estado_actual_id) {
                currentState = await new StateFinder(this.stateRepository).execute(data.estado_actual_id);
            }
            const nextState = await new StateFinder(this.stateRepository).execute(data.siguiente_estado_id);
            const flow = await new FlowFinder(this.flowRepository).execute(data.flujo_id);

            const response = {
                ...data,
                estado_actual: currentState ? currentState.toJson() : null,
                siguiente_estado: nextState.toJson(),
                flujo: flow.toJson(),
            };

            return HttpResponse.ok({ data: response, event: this.event });
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

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'transitions', 'TransitionsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                order: undefined,
                limit: 10,
                offset: 0,
            };
            const response = await new TransitionSearcher(this.repository).execute(dtoCriteria);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
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
            const hasPermission = this.user.hasPermission('administrador', 'transitions', 'TransitionsRead');
            if (!hasPermission) {
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

            const authorizedQuery = this.#authorizeSearch('transitions.search', data.value);
            const response = await new TransitionSearcher(this.repository).execute(authorizedQuery);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }
}
