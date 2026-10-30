import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
    activeGroupScopeFromAuthenticatedUser,
} from '@kace/api-common';
import {
    applyServerManagedFields,
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { CustomError, Helper } from '@kace/core/src/shared';
import { InteractionJoinCaseSchema } from './schema.mjs';
import {
    CaseViewNameResolver,
    KnexCaseRepository,
    KnexViewCaseRepository,
    ViewCaseSearcher,
} from '@kace/core/src/cases';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { AssociateInteractionToCaso } from '@kace/core/src/interactions/application/associateInteractionToCaso/AssociateInteractionToCaso';
import { KnexAssociateInteractionToCasoRepo } from '@kace/core/src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo';
import { AssociateInteractionToCasoSearch } from '@kace/core/src/interactions/application/associateInteractionToCasoSearch/AssociateInteractionToCasoSearch';
import { LinkedInteractionCasesFinder } from '@kace/core/src/interactions/application/linked-cases/LinkedInteractionCasesFinder';
import Joi from 'joi';
import { executeCandidateCasesSearch, isCandidateCaseSearch } from './candidate-cases-search-action.mjs';

const AGENT_INTERACTION_CASES_RESOURCE = '/agent/interaction-cases';
const AGENT_INTERACTION_CASE_RESOURCE = '/agent/interaction-cases/{id}';
const ACTIVE_CASE_FILTER = { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' };
const OPEN_CASE_FILTER = { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'AND' };
const CANDIDATE_TEXT_SEARCH_FIELDS = new Set([
    'nivel1',
    'nivel2',
    'nivel3',
    'nivel4',
    'nivel5',
    'nivel6',
    'nivel7',
    'nivel8',
    'nivel9',
    'nivel10',
    'nombres',
    'login',
]);
const CANDIDATE_SEARCH_FIELDS = new Set(['reference', ...CANDIDATE_TEXT_SEARCH_FIELDS]);
const CANDIDATE_FILTER_VALUE_SCHEMA = Joi.alternatives().try(Joi.string(), Joi.number()).required();
const DEFAULT_DEPENDENCIES = Object.freeze({
    KnexAssociateInteractionToCasoRepo,
    KnexCaseRepository,
    KnexInteractionRepository,
    AssociateInteractionToCaso,
    CaseViewNameResolver,
    KnexViewCaseRepository,
    AssociateInteractionToCasoSearch,
    ViewCaseSearcher,
    LinkedInteractionCasesFinder,
});

function hasPermission(user, role, moduleId, permission) {
    try {
        return Boolean(user?.hasPermission?.(role, moduleId, permission));
    } catch {
        return false;
    }
}

function canReadLinkedCases(user) {
    return (
        hasPermission(user, 'administrador', 'interactions', 'InteractionsRead') ||
        hasPermission(user, 'agente', 'interactions', 'InteractionsCreate')
    );
}

const cleanCaseViewFilterField = (filter) => {
    if (filter.groupType && Array.isArray(filter.filters)) {
        return {
            ...filter,
            filters: filter.filters.map(cleanCaseViewFilterField),
        };
    }

    if (filter.field.includes('.')) {
        return {
            ...filter,
            field: filter.field.split('.')[1],
        };
    }

    return filter;
};

const hasFilterValue = (value) => {
    const { error } = CANDIDATE_FILTER_VALUE_SCHEMA.validate(value, { convert: false });
    return !error && String(value).trim() !== '';
};

const isSelectedClientFilter = (filter) =>
    !filter.groupType &&
    filter.field === 'cliente_id' &&
    filter.operator === 'eq' &&
    filter.type === 'AND' &&
    hasFilterValue(filter.value);

const isLinkedExclusionFilter = (filter) =>
    !filter.groupType &&
    filter.field === 'id' &&
    filter.operator === 'notIn' &&
    filter.type === 'AND' &&
    hasFilterValue(filter.value);

const isAllowedCandidateSearchFilter = (filter) => {
    if (filter.groupType || !CANDIDATE_SEARCH_FIELDS.has(filter.field) || !hasFilterValue(filter.value)) {
        return false;
    }

    if (filter.field === 'reference') {
        return filter.operator === 'eq';
    }

    return filter.operator === 'ilike';
};

const sanitizeCandidateSearchGroup = (filter) => {
    if (!filter.groupType || !Array.isArray(filter.filters)) return null;

    const filters = filter.filters.filter(isAllowedCandidateSearchFilter).map((innerFilter) => ({
        field: innerFilter.field,
        operator: innerFilter.operator,
        value: innerFilter.value,
        type: 'OR',
    }));

    if (!filters.length) return null;

    return {
        groupType: 'AND',
        filters,
    };
};

const buildCandidateCaseSearchCriteria = (criteria) => {
    const cleanFilters = Array.isArray(criteria.filter) ? criteria.filter.map(cleanCaseViewFilterField) : [];
    const selectedClientFilter = cleanFilters.find(isSelectedClientFilter);

    if (!selectedClientFilter) {
        return {
            error: [
                {
                    field: 'filter',
                    message: 'A selected client filter is required for candidate case search.',
                },
            ],
        };
    }

    const filter = [
        {
            field: 'cliente_id',
            operator: 'eq',
            value: selectedClientFilter.value,
            type: 'AND',
        },
        { ...ACTIVE_CASE_FILTER },
        { ...OPEN_CASE_FILTER },
    ];

    const linkedExclusionFilter = cleanFilters.find(isLinkedExclusionFilter);
    if (linkedExclusionFilter) {
        filter.push({
            field: 'id',
            operator: 'notIn',
            value: linkedExclusionFilter.value,
            type: 'AND',
        });
    }

    filter.push(...cleanFilters.map(sanitizeCandidateSearchGroup).filter(Boolean));

    return {
        value: {
            ...criteria,
            filter,
            relationship: null,
        },
    };
};

export class ControllerAssociateInteractionToCaso extends BaseController {
    #event;
    #caseViewRepository = null;
    #dependencies;

    constructor(event, knexConfig, dependencies = DEFAULT_DEPENDENCIES) {
        super(event, knexConfig);

        // search()/finder reads go to the replica; the associate save() is guarded by markWrite and
        // its idempotency exists() check stays on the writer. The cases repo is shared with the cases
        // BC and is only used for a write-path validation finder → keep it on the writer.
        const { readerConfig } = this.event.tenantContext;
        this.#dependencies = dependencies;
        this.repository = new dependencies.KnexAssociateInteractionToCasoRepo(knexConfig, readerConfig);
        this.casesRepo = new dependencies.KnexCaseRepository(knexConfig);
        this.interactionRepo = new dependencies.KnexInteractionRepository(knexConfig, readerConfig);
        this.started_at = new Date();
        this.#event = event;
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
        await this.interactionRepo.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin action Interaction Join Cases Create');
        try {
            const canAssociateInteractionCase =
                hasPermission(this.user, 'administrador', 'interactions', 'InteractionsCreate') ||
                hasPermission(this.user, 'agente', 'interactions', 'InteractionsCreate');

            if (!canAssociateInteractionCase) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to execute import processing.',
                    event: this.#event,
                });
            }

            Helper.logInfo('Extracting and preparing payload');
            const payload = applyServerManagedFields(this.payload(), {
                operation: 'create',
                userId: this.user.id.value,
                now: this.started_at,
            });

            const data = InteractionJoinCaseSchema.validate(payload, {
                abortEarly: false,
            });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            const isAgentRoute =
                (this.#event.originalResource ?? this.#event.resource) === AGENT_INTERACTION_CASES_RESOURCE;
            if (!isAgentRoute) {
                await assertAuthorizedRelationships({
                    payload: data.value,
                    repository: this.repository,
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /interactions/cases',
                    resourceType: 'interaction_casos',
                    relationships: [
                        { field: 'interaction_id', table: 'interactions', notDeleted: false },
                        { field: 'caso_id', table: 'cases', notDeleted: false },
                    ],
                });
            }

            Helper.logInfo('Creating interaction join cases');
            const associateCreate = new this.#dependencies.AssociateInteractionToCaso(
                this.repository,
                this.casesRepo,
                this.interactionRepo
            );
            if (isAgentRoute) {
                await associateCreate.execute(data.value, activeGroupScopeFromAuthenticatedUser(this.user));
            } else {
                await associateCreate.execute(data.value);
            }

            Helper.logInfo('Interaction join cases successfully processed');
            return HttpResponse.ok({
                message: 'interaction join cases processed',
                event: this.#event,
            });
        } catch (error) {
            if (error instanceof CustomError && error.statusCode === 404) {
                return HttpResponse.notFound({ message: 'Interaction not found', event: this.#event });
            }
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End Interaction Join Cases');
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
        if (isCandidateCaseSearch(this.#event)) {
            return this.#actionSearchCandidateCases();
        }

        return this.#actionSearchAssociations();
    }

    async #buildCaseViewRepository() {
        if (this.#caseViewRepository) return this.#caseViewRepository;

        const globalConfig = await this.getGlobalConfig();
        const resolver = new this.#dependencies.CaseViewNameResolver(this.database_connection);
        const viewName = await resolver.resolve(globalConfig);
        this.#caseViewRepository = new this.#dependencies.KnexViewCaseRepository(this.database_connection, viewName);
        return this.#caseViewRepository;
    }

    async #actionSearchAssociations() {
        Helper.logInfo('Begin action Interaction Join Cases actionSearch');
        try {
            const canSearchAssociation = hasPermission(this.user, 'administrador', 'interactions', 'InteractionsRead');
            if (!canSearchAssociation) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            const authorizedQuery = this.#authorizeSearch(
                'interactions.associate-interaction-to-caso.search',
                data.value
            );
            const response = await new this.#dependencies.AssociateInteractionToCasoSearch(
                this.repository,
                this.interactionRepo
            ).execute(authorizedQuery);

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
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async #actionSearchCandidateCases() {
        Helper.logInfo('Begin action Interaction Case Candidates actionSearch');
        try {
            const canSearchCandidateCases =
                hasPermission(this.user, 'administrador', 'interactions', 'InteractionsRead') ||
                hasPermission(this.user, 'agente', 'interactions', 'InteractionsCreate');

            if (!canSearchCandidateCases) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const data = SearchSchema.validate(this.payload(), { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.#event,
                });
            }

            const candidateCriteria = buildCandidateCaseSearchCriteria(data.value);
            if (candidateCriteria.error) {
                return HttpResponse.validationsFail({
                    errors: candidateCriteria.error,
                    event: this.#event,
                });
            }

            const searchResult = await executeCandidateCasesSearch({
                query: candidateCriteria.value,
                authorize: (endpointKey, query) => this.#authorizeSearch(endpointKey, query),
                search: async (authorizedQuery) => {
                    const repository = await this.#buildCaseViewRepository();
                    return new this.#dependencies.ViewCaseSearcher(repository).execute(authorizedQuery);
                },
                isAuthorizationError: (error) => error instanceof SearchAuthorizationError,
            });

            if (searchResult.kind === 'forbidden') {
                return HttpResponse.forbidden({
                    message: searchResult.error.message,
                    event: this.event,
                });
            }

            return HttpResponse.ok({ ...searchResult.response.toJson(), event: this.event });
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
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin action Interaction Join Cases actionRead');
        try {
            if (!canReadLinkedCases(this.user)) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const interactionId = this.pathParameters()?.id;
            const isAgentRoute =
                (this.#event.originalResource ?? this.#event.resource) === AGENT_INTERACTION_CASE_RESOURCE;
            const finder = isAgentRoute
                ? new this.#dependencies.LinkedInteractionCasesFinder(
                      this.repository,
                      this.casesRepo,
                      this.interactionRepo
                  )
                : new this.#dependencies.LinkedInteractionCasesFinder(this.repository, this.casesRepo);
            const response = isAgentRoute
                ? await finder.execute(interactionId, activeGroupScopeFromAuthenticatedUser(this.user))
                : await finder.execute(interactionId);

            return HttpResponse.ok({ data: response, event: this.event });
        } catch (error) {
            if (error instanceof CustomError && error.statusCode === 404) {
                return HttpResponse.notFound({ message: 'Interaction not found', event: this.#event });
            }
            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }
}
