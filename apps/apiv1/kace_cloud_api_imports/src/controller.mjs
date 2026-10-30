import { BaseController, HttpResponse } from '@kace/api-common';
import { createSchema } from './schemas.mjs';
import { Helper } from '@kace/core/src/shared/index.js';
import { S3FileImport } from '@kace/core/src/imports/application/import/S3FileImport';
import { KnexS3ImportFiles } from '@kace/core/src/imports/infrastructure/persistence/KnexS3ImportFiles';
import { ImportExecutionRequested } from '@kace/core/src/imports/domain/events/ImportExecutionRequested.js';

export class Controller extends BaseController {
    #repository;
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#repository = new KnexS3ImportFiles(this.database_connection);
        this.created_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'imports', 'Imports');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to import catalogs.',
                    event: this.event,
                });
            }

            const payload = this.payload();

            const { value, error } = createSchema.validate(payload, {
                abortEarly: false,
            });

            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const filePath = value.presignedUrl.split('.com')[1].split('?')[0];

            const fileId = await new S3FileImport(this.#repository).execute({
                file_path: filePath.startsWith('/') ? filePath.slice(1) : filePath,
                target_table: value.targetTable,
                created_by: this.user.id.value,
                created_at: this.created_at,
                action_type: value.actionType,
                should_override_array: value.shouldOverrideArray ?? false,
            });

            if (this.eventPublisher && fileId) {
                const domainEvent = new ImportExecutionRequested({
                    fileId,
                    targetTable: value.targetTable,
                    actionType: value.actionType,
                    metadata: {
                        tenant_id: this.tenant?.id?.value || null,
                        user_id: this.user?.id?.value || null,
                    },
                });

                await this.eventPublisher.publish(domainEvent);
            }

            return HttpResponse.ok({
                message: 'archivo registrado en la cola de ejecucion',
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
