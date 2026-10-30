import { BaseController, HttpResponse } from '@kace/api-common';
import {
    applyServerManagedFields,
    ObjectIdentityAuthorizationError,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { schemaCreate, schemaUpdate } from './schemas.mjs';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import KnexFakeCaseRepository from '@kace/core/src/fake-cases/infrastructure/persistence/KnexFakeCaseRepository.js';
import { FakeCaseCreator } from '@kace/core/src/fake-cases/application/create/FakeCaseCreator.js';
import FakeCaseUpdater from '@kace/core/src/fake-cases/application/update/FakeCaseUpdater.js';
import FakeCaseDeleter from '@kace/core/src/fake-cases/application/delete/FakeCaseDeleter.js';
import { FakeCaseFinder } from '@kace/core/src/fake-cases/application/find/FakeCaseFinder.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.event = event;
        this.repository = new KnexFakeCaseRepository(this.database_connection);
        this.started_at = new Date();
        this.fakeCaseCreatorFactory = (repository) => new FakeCaseCreator(repository);
        this.fakeCaseUpdaterFactory = (repository) => new FakeCaseUpdater(repository);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }
            let payload = applyServerManagedFields(this.payload(), {
                operation: 'create',
                userId: this.user.id.value,
                now: this.started_at,
            });
            const identity = await resolveCanonicalCreateIdentity({
                payload,
                allowLegacyId: false,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /tempcases',
                resourceType: 'fake_cases',
            });
            payload = identity.payload;

            const { value, error } = schemaCreate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (value.cliente_id) {
                await this.#ensureClientRelationship(value.cliente_id);
            }
            if (value.transicion_id) {
                await this.#ensureTransitionRelationship(value.transicion_id);
            }
            if (value.responsable_id) {
                await this.#ensureResponsableRelationship(value.responsable_id);
            }
            if (value.clasificacion_id) {
                await this.#ensureClasificationRelationship(value.clasificacion_id);
            }
            if (value.grupo_id) {
                await this.#ensureGroupRelationship(value.grupo_id);
            }

            const response = await this.fakeCaseCreatorFactory(this.repository).execute(value);

            return HttpResponse.created({ ...response.toJson(), event: this.event });
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
            const hasCreatePermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            const hasUpdatePermission =
                this.user.hasPermission('agente', 'cases', 'CasesUpdate') ||
                this.user.hasPermission('administrador', 'cases', 'CasesUpdate');
            if (!hasCreatePermission && !hasUpdatePermission) {
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

            await this.#assertDraftMutable(id);

            const payload = applyServerManagedFields(this.payload(), {
                operation: 'update',
                userId: this.user.id.value,
                now: new Date(),
            });
            const { value, error } = schemaUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (value.cliente_id) {
                await this.#ensureClientRelationship(value.cliente_id);
            }
            if (value.transicion_id) {
                await this.#ensureTransitionRelationship(value.transicion_id);
            }
            if (value.responsable_id) {
                await this.#ensureResponsableRelationship(value.responsable_id);
            }
            if (value.clasificacion_id) {
                await this.#ensureClasificationRelationship(value.clasificacion_id);
            }
            if (value.grupo_id) {
                await this.#ensureGroupRelationship(value.grupo_id);
            }

            await this.fakeCaseUpdaterFactory(this.repository).execute(id, value);

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

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
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

            await new FakeCaseDeleter(this.repository).execute(id);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
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

            const response = await new FakeCaseFinder(this.repository).execute(id);

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

    async #ensureClientRelationship(clientId) {
        const client = await this.repository
            .connection(this.repository.qualifiedName('clients'))
            .select('id')
            .where({ id: clientId })
            .first();

        if (!client) {
            throw new CustomError(`Client with id ${clientId} does not exist.`, 404);
        }
    }

    async #ensureTransitionRelationship(transitionId) {
        const transitions = await this.repository
            .connection(this.repository.qualifiedName('transiciones'))
            .select('id')
            .where({ id: transitionId })
            .first();

        if (!transitions) {
            throw new CustomError(`Transition with id ${transitionId} does not exist.`, 404);
        }
    }

    async #ensureResponsableRelationship(responsableId) {
        const responsible = await this.repository
            .connection(this.repository.qualifiedName('usuarios'))
            .select('id')
            .where({ id: responsableId })
            .first();

        if (!responsible) {
            throw new CustomError(`Responsible with id ${responsableId} does not exist.`, 404);
        }
    }

    async #ensureClasificationRelationship(clasificationId) {
        const classification = await this.repository
            .connection(this.repository.qualifiedName('clasificaciones'))
            .select('id')
            .where({ id: clasificationId })
            .first();

        if (!classification) {
            throw new CustomError(`Clasification with id ${clasificationId} does not exist.`, 404);
        }
    }

    async #ensureGroupRelationship(groupId) {
        const group = await this.repository
            .connection(this.repository.qualifiedName('grupos'))
            .select('id')
            .where({ id: groupId })
            .first();

        if (!group) {
            throw new CustomError(`Group with id ${groupId} does not exist.`, 404);
        }
    }

    async #assertDraftMutable(id) {
        const draft = await this.repository.find(new ValueObjectUuid('id', id));
        if (!draft) {
            throw new ObjectIdentityAuthorizationError({
                message: `Fake case draft ${id} does not exist`,
                code: 'draft_not_found',
                field: 'id',
                statusCode: 404,
                metadata: { endpoint: 'POST /tempcases/{id}', resourceType: 'fake_cases', targetId: id },
            });
        }

        const ownerId = draft.created_by?.value ?? draft.created_by;
        const canUpdateAnyDraft =
            this.user.hasPermission('agente', 'cases', 'CasesUpdate') ||
            this.user.hasPermission('administrador', 'cases', 'CasesUpdate');
        const ownsDraft = ownerId && ownerId === this.user.id.value;

        if (!ownsDraft && !canUpdateAnyDraft) {
            throw new ObjectIdentityAuthorizationError({
                message: `Fake case draft ${id} is not accessible`,
                code: 'draft_update_forbidden',
                field: 'id',
                statusCode: 403,
                metadata: { endpoint: 'POST /tempcases/{id}', resourceType: 'fake_cases', targetId: id },
            });
        }
    }
}
