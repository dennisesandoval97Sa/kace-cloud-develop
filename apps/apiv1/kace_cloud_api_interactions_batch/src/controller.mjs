import { BaseController, HttpResponse } from '@kace/api-common';
import {
    assertAuthorizedRelationships,
    buildBroadRelationshipRules,
    objectIdentityErrorResponse,
    secureObjectCreatePayload,
} from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { createSchema } from './schemas.mjs';
import { KnexInteractionRepository } from '@kace/core/src/interactions/infrastructure/persistence/KnexInteractionRepository';
import { InteractionBatchCreator } from '@kace/core/src/interactions/application/create/InteractionBatchCreator';
import { InteractionEmailAlreadyLinkedError } from '@kace/core/src/interactions/domain/InteractionEmailAlreadyLinkedError.js';
import { canImportInteractionState } from '@kace/core/src/interactions/application/create/InteractionStateImportPolicy.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        // Pass CONFIG objects, not this.database_connection (a built Knex instance):
        // that would collapse the reader onto the writer.
        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexInteractionRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    /**
     * Runs the broad relationship check (email_id, workspace_id, ...) once for the whole batch:
     * ids are deduplicated first, so N items pointing at the same email cost a single SELECT.
     * assertAuthorizedRelationships already accepts an array of ids per field.
     *
     * @param {object[]} dtos payloads already enriched by secureObjectCreatePayload.
     */
    async #authorizeBatchRelationships(dtos) {
        const idsByField = new Map();

        for (const dto of dtos) {
            for (const { field } of buildBroadRelationshipRules(dto)) {
                const value = dto[field];
                if (value === undefined || value === null || value === '') continue;

                if (!idsByField.has(field)) idsByField.set(field, new Set());
                for (const id of Array.isArray(value) ? value : [value]) idsByField.get(field).add(id);
            }
        }

        const payload = Object.fromEntries([...idsByField].map(([field, ids]) => [field, [...ids]]));
        const relationships = buildBroadRelationshipRules(payload);
        if (relationships.length === 0) return;

        await assertAuthorizedRelationships({
            payload,
            repository: this.repository,
            relationships,
            actorId: this.user.id.value,
            tenantId: this.tenant?.id?.value,
            endpoint: 'POST /interactions-batch',
            resourceType: 'interactions',
        });
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'interactions', 'InteractionsCreate');
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

            if (!canImportInteractionState(this.user, items)) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to import interaction state.',
                    event: this.event,
                });
            }

            const dtos = [];
            for (const item of items) {
                const payload = await secureObjectCreatePayload({
                    payload: item,
                    userId: this.user.id.value,
                    now: this.started_at,
                    actorId: this.user.id.value,
                    tenantId: this.tenant?.id?.value,
                    endpoint: 'POST /interactions-batch',
                    resourceType: 'interactions',
                    repository: this.repository,
                    // Relationships are checked once for the whole batch (below) instead of
                    // once per item, which would run one SELECT per repeated id.
                    relationships: [],
                });
                dtos.push(payload);
            }

            await this.#authorizeBatchRelationships(dtos);

            const ids = await new InteractionBatchCreator(this.repository).execute(dtos);

            return HttpResponse.created({ data: { ids }, event: this.event });
        } catch (error) {
            if (error instanceof InteractionEmailAlreadyLinkedError) {
                return HttpResponse.conflict({
                    message: error.message,
                    data: error.toPublicData(),
                    publicData: error.toPublicData(),
                    event: this.event,
                    code: error.publicErrorCode,
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
            Helper.logInfo('End actionCreate');
        }
    }
}
