import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TenantContextManager } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';

const SYSTEM_USER = '7d15692d-5bf4-4135-8096-06e7b1098b54';

/**
 * Resets the per-tenant `apps_debug` flag in the multitenant DynamoDB table.
 *
 * The authoritative toggle for a Lambda is its `APPS_DEBUG` env var (handled by
 * LambdaDebugService); this complements it by clearing the tenant-level fallback
 * flag so debug is fully off for that tenant.
 *
 * IMPORTANT — data safety: this issues a *surgical* `UpdateCommand` that only
 * touches `apps_debug`, `updated_at` and `updated_by`. It deliberately does NOT
 * round-trip the Tenant aggregate (find → save), because the repository's `save()`
 * uses `PutItem` (full-item replace) serialized from the domain model, which would
 * drop any DynamoDB attribute not modeled as a getter on `Tenant`. The
 * `attribute_exists(id)` condition prevents creating a phantom tenant if the id is
 * wrong. A DynamoDB failure here must NOT break the disable flow, so errors are
 * logged and swallowed.
 */
export class TenantDebugFlag {
    #client;
    #tableName;
    #invalidate;

    constructor(deps = {}) {
        this.#tableName = deps.tableName ?? process.env.TARGET_DYNAMODB_TABLE;
        this.#client =
            deps.client ??
            DynamoDBDocumentClient.from(
                new DynamoDBClient({ region: process.env.TARGET_DYNAMODB_REGION ?? 'us-east-1' })
            );
        this.#invalidate = deps.invalidate ?? ((id) => TenantContextManager.invalidateTenant(id));
    }

    /**
     * Sets `apps_debug='false'` for the given tenant and invalidates its cache.
     * @param {string} tenantId
     * @returns {Promise<{ updated: boolean }>}
     */
    async disable(tenantId) {
        if (!tenantId) {
            Helper.logError('TenantDebugFlag.disable called without tenantId');
            return { updated: false };
        }

        if (!this.#tableName) {
            Helper.logError('TenantDebugFlag.disable: TARGET_DYNAMODB_TABLE is not set');
            return { updated: false };
        }

        try {
            await this.#client.send(
                new UpdateCommand({
                    TableName: this.#tableName,
                    Key: { id: tenantId },
                    // Only these three attributes change; every other attribute is left untouched.
                    UpdateExpression: 'SET apps_debug = :d, updated_at = :ua, updated_by = :ub',
                    ExpressionAttributeValues: {
                        ':d': 'false',
                        ':ua': new Date().toISOString(),
                        ':ub': SYSTEM_USER,
                    },
                    // Never create a new (phantom) tenant if the id does not exist.
                    ConditionExpression: 'attribute_exists(id)',
                })
            );
            this.#invalidate(tenantId);
            Helper.logInfo('Tenant apps_debug reset to false', { tenantId });
            return { updated: true };
        } catch (error) {
            // ConditionalCheckFailedException (unknown tenant) or any AWS error: do not break disable.
            Helper.logError('Failed to reset tenant apps_debug in DynamoDB', error);
            return { updated: false };
        }
    }
}
