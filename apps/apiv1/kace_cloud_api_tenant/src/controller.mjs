import { HttpResponse } from '@kace/api-common';
import {
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { schemaCreate, schemaUpdate } from './schemas.mjs';
import {
    TenantCreator,
    TenantDeleter,
    TenantFinder,
    TenantUpdater,
    TenantSearcher,
    DynamoTenantRepository,
} from '@kace/core/src/tenant';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller {
    #event; // Initialized in the constructor
    #repository; // Initialized in the constructor
    #started_at; // Initialized in the constructor
    #system_user = '7d15692d-5bf4-4135-8096-06e7b1098b54';

    constructor(event) {
        this.#repository = new DynamoTenantRepository();
        this.#started_at = new Date();
        this.#event = event;
    }

    /**
     * Helper method to get query parameters from event
     * @param {string} key - Query parameter key
     * @returns {string|null}
     */
    getQueryParams(key) {
        return this.#event.queryStringParameters?.[key] || null;
    }

    /**
     * Helper method to get path parameters from event
     * @param {string} key - Path parameter key
     * @returns {string|null}
     */
    getPathParams(key) {
        return this.#event.pathParameters?.[key] || null;
    }

    /**
     * Helper method to get request body payload
     * @returns {Object}
     */
    payload() {
        try {
            return JSON.parse(this.#event.body || '{}');
        } catch (error) {
            Helper.logError(error);
            return {};
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin tenantIndex');
        try {
            const limit = parseInt(this.getQueryParams('limit') || '20', 10);
            const lastEvaluatedKey = this.getQueryParams('lastEvaluatedKey');

            const options = {
                limit: Math.min(limit, 100), // Max 100 items per request
            };

            if (lastEvaluatedKey) {
                try {
                    options.lastEvaluatedKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8'));
                } catch (error) {
                    Helper.logError(error);
                    return HttpResponse.validationsFail({
                        errors: { lastEvaluatedKey: 'Invalid pagination token' },
                        event: this.#event,
                    });
                }
            }

            const result = await new TenantSearcher(this.#repository).execute(options);

            const response = {
                data: result.items,
                pagination: {},
            };

            if (result.lastEvaluatedKey) {
                response.pagination.nextToken = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
            }

            return HttpResponse.ok({
                ...response,
                event: this.#event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End tenantIndex');
        }
    }

    async actionCreate() {
        Helper.logInfo('Begin tenantCreate');
        try {
            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.#system_user,
                now: this.#started_at,
                actorId: this.#system_user,
                endpoint: 'POST /tenant',
                resourceType: 'tenant',
            });
            const { value, error } = schemaCreate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }

            const tenant = await new TenantCreator(this.#repository).execute(value);

            return HttpResponse.created({
                data: tenant.toJson(),
                event: this.#event,
            });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.#event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End tenantCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin tenantUpdate');
        try {
            const payload = this.payload();
            payload.updated_at = this.#started_at;
            payload.updated_by = payload.updated_by || this.#system_user;

            const { value, error } = schemaUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.#event,
                });
            }

            const id = this.getPathParams('id');
            const tenant = await new TenantUpdater(this.#repository).execute(id, value);

            return HttpResponse.ok({
                data: tenant.toJson(),
                event: this.#event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End tenantUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin tenantDelete');
        try {
            const id = this.getPathParams('id');

            await new TenantDeleter(this.#repository).execute(id);

            return HttpResponse.ok({ event: this.#event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End tenantDelete');
        }
    }

    async actionFindByDNS() {
        Helper.logInfo('Begin tenantFindByDNS');
        try {
            const id = this.getPathParams('id');
            const tenant = await new TenantFinder(this.#repository).execute(id);

            return HttpResponse.ok({
                data: tenant.toJson(),
                event: this.#event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End tenantFindByDNS');
        }
    }

    /**
     * @returns {Promise<Response>}
     */
    async #actions() {
        let response;
        const resource = this.#event.resource;
        const method = this.#event.httpMethod;

        switch (method) {
            case 'GET':
                if (resource === '/') {
                    response = await this.actionIndex();
                } else if (resource === '/{id}') {
                    response = await this.actionFindByDNS();
                } else if (resource === '/{id}/delete') {
                    response = await this.actionDelete();
                } else {
                    response = HttpResponse.notFound({
                        message: `Resource not found: ${resource}`,
                        event: this.event,
                    });
                }
                break;
            case 'POST':
                if (resource === '/') {
                    response = await this.actionCreate();
                } else if (resource === '/{id}') {
                    response = await this.actionUpdate();
                } else {
                    response = HttpResponse.notFound({
                        message: `Resource not found: ${resource}`,
                        event: this.event,
                    });
                }
                break;
            default:
                response = HttpResponse.methodNotAllowed({ event: this.event });
        }

        return response;
    }

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        return await this.#actions();
    }
}
