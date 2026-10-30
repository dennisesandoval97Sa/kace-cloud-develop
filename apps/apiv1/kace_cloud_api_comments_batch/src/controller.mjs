import { BaseController, HttpResponse } from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { createSchema } from './schemas.mjs';
import { CommentBatchCreator, KnexCommentsRepository } from '@kace/core/src/comments';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects, never this.database_connection (an already-built Knex
        // instance bound to the writer): doing so would collapse the reader onto the
        // writer and silently send every read to the primary.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexCommentsRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'comments', 'CommentsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const { value: items, error } = createSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const identityContext = {
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /comments-batch',
                resourceType: 'comments',
            };

            // Check every distinct caso_id ONCE instead of letting the per-item broad rule
            // (caso_id -> cases) fire a SELECT for each element: a 100-item batch over the
            // same case collapses from 100 queries to 1. `notDeleted: false` mirrors exactly
            // what buildBroadRelationshipRules applies on the single-create endpoint.
            const uniqueCaseIds = [...new Set(items.map((item) => item.caso_id))];
            await assertAuthorizedRelationships({
                payload: { caso_id: uniqueCaseIds },
                repository: this.repository,
                relationships: [{ field: 'caso_id', table: 'cases', notDeleted: false }],
                ...identityContext,
            });

            // Enrich each item server-side with a generated id and audit/identity
            // fields, exactly as the single-create endpoint does per request.
            // `relationships: []` skips the broad rule already asserted above.
            const dtos = [];
            for (const item of items) {
                const payload = await secureObjectCreatePayload({
                    payload: item,
                    userId: this.user.id.value,
                    now: this.started_at,
                    repository: this.repository,
                    relationships: [],
                    ...identityContext,
                });
                dtos.push(payload);
            }

            const ids = await new CommentBatchCreator(this.repository).execute(dtos);

            return HttpResponse.created({ data: { ids }, event: this.event });
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
}
