import { BaseController, HttpResponse } from '@kace/api-common';
import {
    FieldListApplication,
    KnexFieldListRepository,
    ListTablesApplication,
} from '@kace/core/src/field-list/index.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { schemaBase } from './schemas.mjs';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Read-only metadata service → wire the reader (pass CONFIG objects, not
        // this.database_connection, §8.1 footgun). Schema is derived from the config by KnexRepository.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexFieldListRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'field-lists', 'FieldListsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const tableName = this.pathParameters().id;

            const data = schemaBase.validate([tableName]);

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: {
                        message: 'Invalid request. The requested resource is not available.',
                    },
                    event: this.event,
                });
            }

            const fieldListResponse = await new FieldListApplication(this.repository).execute(data.value[0]);

            return HttpResponse.ok({
                data: { items: fieldListResponse },
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: { message: 'An error occurred while processing your request.' },
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'field-lists', 'FieldListsRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'field-lists', 'FieldListsRead');

            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }
            Helper.logDebug(this.event.headers);
            const xEncriptedKey = this.getHeader('x-public-key');
            if (!xEncriptedKey) {
                return HttpResponse.validationsFail({
                    errors: { message: 'Invalid request. Missing X-Public-Key header.' },
                    event: this.event,
                });
            }

            const fieldListResponse = await new ListTablesApplication(this.repository).execute(xEncriptedKey);

            return HttpResponse.ok({ data: fieldListResponse, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }
}
