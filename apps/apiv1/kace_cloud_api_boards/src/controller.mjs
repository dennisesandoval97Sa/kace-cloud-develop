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
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { Helper, ValidationFailError } from '@kace/core/src/shared';
import { boardCreate, boardUpdate } from './schemas.mjs';
import { BoardCreator } from '@kace/core/src/boards/application/create/BoardCreator';
import { BoardUpdater } from '@kace/core/src/boards/application/update/BoardUpdater';
import { BoardSearcher } from '@kace/core/src/boards/application/search/BoardSearcher';
import { BoardDeleter } from '@kace/core/src/boards/application/delete/BoardDeleter';
import { BoardResponse } from '@kace/core/src/boards/application/BoardResponse';
import { BoardFinder } from '@kace/core/src/boards/domain/BoardFinder';
import { BoardAccessPolicy } from '@kace/core/src/boards/domain/BoardAccessPolicy';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexBoardsRepository(this.database_connection);
        this.started_at = new Date();
    }

    /**
     * Llave maestra: quien tiene `boards.BoardsAccessAll` opera todos los tableros del
     * tenant, se los hayan asignado o no. Sin esta via, un tablero cuyo creador causo baja
     * y cuyas listas de acceso quedaron obsoletas no se podria listar, abrir, editar ni
     * borrar por API.
     *
     * Es un permiso propio del modulo y nace sin conceder, precisamente para que sea una
     * excepcion. Antes se usaba `access-admin.Access`, que no vale como llave: es el
     * permiso que da entrada al panel de administracion (ver AccessMiddleware), asi que lo
     * tiene todo el que puede abrir el listado y el recorte por acceso no llegaba a
     * aplicarse nunca.
     *
     * @returns {boolean}
     */
    #isBoardAdmin() {
        return this.user.hasPermission('administrador', 'boards', 'BoardsAccessAll');
    }

    /**
     * Acceso efectivo del llamante, tal y como lo consumen la politica y el listado.
     * @returns {{userId: string, groupId: string, isBoardAdmin: boolean}}
     */
    #actor() {
        return {
            userId: this.user.id.value,
            groupId: this.user.grupo_activo.value,
            isBoardAdmin: this.#isBoardAdmin(),
        };
    }

    /**
     * Carga el tablero y comprueba que el usuario tenga acceso a el.
     *
     * El permiso de modulo (BoardsRead/Update/Delete) habilita la accion; el acceso al
     * tablero concreto lo decide BoardAccessPolicy, igual que en /{id}/resources. Sin esta
     * comprobacion cualquier usuario con el permiso podia leer y modificar tableros ajenos
     * llamando al endpoint directamente.
     *
     * @param {string} id
     * @returns {Promise<{board: Board}|{response: HttpResponse}>}
     */
    async #findAccessibleBoard(id) {
        const board = await new BoardFinder(this.repository).execute(id);

        if (!board) {
            return { response: HttpResponse.notFound({ message: 'Board not found', event: this.event }) };
        }

        const canAccess = BoardAccessPolicy.canAccess(board, this.#actor());

        if (!canAccess) {
            return {
                response: HttpResponse.forbidden({
                    message: 'User does not have access to this board.',
                    event: this.event,
                }),
            };
        }

        return { board };
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsCreate');
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
                endpoint: 'POST /boards',
                resourceType: 'boards',
                repository: this.repository,
            });

            const data = boardCreate.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const dto = {
                ...data.value,
                created_at: this.started_at,
                created_by: this.user.id.value,
            };

            await new BoardCreator(this.repository).execute(dto);

            return HttpResponse.created({ data: { id: dto.id }, event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsUpdate');
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

            const access = await this.#findAccessibleBoard(id);
            if (access.response) return access.response;

            const data = boardUpdate.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const dto = {
                ...data.value,
                updated_at: new Date().toISOString(),
                updated_by: this.user.id.value,
            };

            const response = await new BoardUpdater(this.repository).execute(dto, id);
            return HttpResponse.ok({ data: response.toJson(), event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            if (error instanceof ValidationFailError) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsDelete');
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

            const access = await this.#findAccessibleBoard(id);
            if (access.response) return access.response;

            const dto = {
                deleted_at: new Date().toISOString(),
                deleted_by: this.user.id.value,
            };

            await new BoardDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logError(error);
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
            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsRead');
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
            const access = await this.#findAccessibleBoard(id);
            if (access.response) return access.response;

            // Se reutiliza el board que ya cargo la comprobacion de acceso: sin esto la
            // lectura haria dos consultas identicas por peticion.
            const response = new BoardResponse(access.board);
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
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');

        const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsRead');
        if (!hasPermission) {
            return HttpResponse.forbidden({
                message: 'You do not have permission to read this resource.',
                event: this.event,
            });
        }
        try {
            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'desc',
                },
            };
            // El recorte por acceso lo pone el servidor: el listado devuelve los mismos
            // tableros que actionRead autoriza a abrir, salvo para la llave maestra.
            const response = await new BoardSearcher(this.repository).execute(dtoCriteria, this.#actor());
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof ValidationFailError) {
                return HttpResponse.badRequest({
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
            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsRead');
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

            const authorizedQuery = this.#authorizeSearch('boards.search', data.value);
            // Los pseudo-campos de acceso del payload solo estrechan este conjunto: el
            // acceso efectivo del llamante lo deriva el servidor del token.
            const response = await new BoardSearcher(this.repository).execute(authorizedQuery, this.#actor());

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            if (error instanceof ValidationFailError) {
                return HttpResponse.badRequest({
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
