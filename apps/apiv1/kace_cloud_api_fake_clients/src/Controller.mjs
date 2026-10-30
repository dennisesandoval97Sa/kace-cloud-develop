import { ClientCreateSchema, ClientUpdateSchema } from './schema.mjs';
import { HttpResponse, BaseController } from '@kace/api-common';
import {
    applyServerManagedFields,
    assertAuthorizedRelationships,
    assertCreateRouteUpdateAuthorized,
    ObjectIdentityAuthorizationError,
    objectIdentityErrorResponse,
    resolveCanonicalCreateIdentity,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { KnexFakeClientRepository } from '@kace/core/src/fake-clients/infrastructure/persistence/KnexFakeClientRepository.js';
import { FakeClientCreator } from '@kace/core/src/fake-clients/application/create/FakeClientCreator.js';
import { KnexClientRepository } from '@kace/core/src/clients/index.js';
import { FakeClientUpdater } from '@kace/core/src/fake-clients/application/update/FakeClientUpdater.js';
import { FakeClientDeleter } from '@kace/core/src/fake-clients/application/delete/FakeClientDeleter.js';
import { ClientFinder } from '@kace/core/src/fake-clients/application/find/FakeClientFinder.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexFakeClientRepository(this.database_connection);
        this.clientRepository = new KnexClientRepository(this.database_connection);
        this.started_at = new Date();
        this.fakeClientCreatorFactory = (repository) => new FakeClientCreator(repository);
        this.fakeClientUpdaterFactory = (repository, clientRepository) =>
            new FakeClientUpdater(repository, clientRepository);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');

        try {
            const hasPermission = this.user.hasPermission('agente', 'clients', 'ClientsCreate');
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
                endpoint: 'POST /fake_clients',
                resourceType: 'fake_clients',
            });
            payload = identity.payload;

            const fakeClientExist = await this.repository.find(new ValueObjectUuid('id', payload.id));

            if (!fakeClientExist) {
                const { error, value } = ClientCreateSchema.validate(payload, {
                    abortEarly: false,
                });
                if (error) {
                    return HttpResponse.validationsFail({
                        errors: error,
                        event: this.event,
                    });
                }
                await assertAuthorizedRelationships({
                    payload: value,
                    repository: this.repository,
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /fake_clients',
                    resourceType: 'fake_clients',
                    relationships: [
                        { field: 'padre_id', table: 'clients' },
                        { field: 'contactos', table: 'clients' },
                    ],
                });
                await this.fakeClientCreatorFactory(this.repository).execute(value);
                return HttpResponse.created({
                    data: { id: value.id },
                    event: this.event,
                });
            } else {
                assertCreateRouteUpdateAuthorized({
                    user: this.user,
                    existingObject: fakeClientExist,
                    permission: [
                        { role: 'agente', moduleId: 'clients', action: 'ClientsUpdate' },
                        { role: 'administrador', moduleId: 'clients', action: 'ClientsUpdate' },
                    ],
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /fake_clients',
                    resourceType: 'fake_clients',
                });
                const targetId = payload.id;
                delete payload.id;
                delete payload.created_by;
                delete payload.created_at;
                delete payload.contactos;

                if (payload.tipo_documento === 'NIT') {
                    payload.nombres = null;
                    payload.apellido1 = null;
                    payload.apellido2 = null;
                    payload.sexo = null;
                    payload.fecha_nacimiento = null;
                    payload.estado_civil = null;
                } else {
                    payload.nombre_empresa = null;
                }

                const { error, value } = ClientUpdateSchema.validate(payload, {
                    abortEarly: false,
                });
                if (error) {
                    return HttpResponse.validationsFail({
                        errors: error,
                        event: this.event,
                    });
                }
                await assertAuthorizedRelationships({
                    payload: value,
                    repository: this.repository,
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /fake_clients',
                    resourceType: 'fake_clients',
                    relationships: [{ field: 'padre_id', table: 'clients' }],
                });
                await this.fakeClientUpdaterFactory(this.repository, this.clientRepository).execute(targetId, value);
                return HttpResponse.ok({ event: this.event });
            }
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
            const hasCreatePermission = this.user.hasPermission('agente', 'clients', 'ClientsCreate');
            const hasUpdatePermission =
                this.user.hasPermission('agente', 'clients', 'ClientsUpdate') ||
                this.user.hasPermission('administrador', 'clients', 'ClientsUpdate');
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
                now: this.started_at,
            });

            const { error, value } = ClientUpdateSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            await assertAuthorizedRelationships({
                payload: value,
                repository: this.repository,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /fake_clients/{id}',
                resourceType: 'fake_clients',
                relationships: [{ field: 'padre_id', table: 'clients' }],
            });
            await this.fakeClientUpdaterFactory(this.repository, this.clientRepository).execute(id, value);
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
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsDelete');
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

            await new FakeClientDeleter(this.repository).execute(id);
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
            const hasPermission = this.user.hasPermission('administrador', 'clients', 'ClientsRead');
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
            const response = await new ClientFinder(this.repository).execute(id);
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

    async #assertDraftMutable(id) {
        const draft = await this.repository.find(new ValueObjectUuid('id', id));
        if (!draft) {
            throw new ObjectIdentityAuthorizationError({
                message: `Fake client draft ${id} does not exist`,
                code: 'draft_not_found',
                field: 'id',
                statusCode: 404,
                metadata: { endpoint: 'POST /fake_clients/{id}', resourceType: 'fake_clients', targetId: id },
            });
        }

        const ownerId = draft.created_by?.value ?? draft.created_by;
        const canUpdateAnyDraft =
            this.user.hasPermission('agente', 'clients', 'ClientsUpdate') ||
            this.user.hasPermission('administrador', 'clients', 'ClientsUpdate');
        const ownsDraft = ownerId && ownerId === this.user.id.value;

        if (!ownsDraft && !canUpdateAnyDraft) {
            throw new ObjectIdentityAuthorizationError({
                message: `Fake client draft ${id} is not accessible`,
                code: 'draft_update_forbidden',
                field: 'id',
                statusCode: 403,
                metadata: { endpoint: 'POST /fake_clients/{id}', resourceType: 'fake_clients', targetId: id },
            });
        }
    }
}
