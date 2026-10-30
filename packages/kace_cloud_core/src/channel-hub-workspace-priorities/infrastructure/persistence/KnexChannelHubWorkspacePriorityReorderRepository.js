import {
    BAD_REQUEST_ERROR,
    CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
    CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
    CONFLICT_ERROR,
    NOT_FOUND_ERROR,
    normalizePublicErrorCode,
} from '@kace/error-codes';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import {
    ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES,
    ChannelHubWorkspacePriorityReorderConflict,
} from '../../domain/channelHubWorkspacePriorityReorderConflict.js';

const TABLE = 'channel_hub_workspace_priority_reorders';
const OUTBOX_TABLE = 'channel_hub_workspace_priority_reorder_outbox';
const ACTIVE_INDEX = 'uq_channel_hub_workspace_priority_reorders_active_account';

const resultForPersistence = (result) => ({
    ...result,
    items: result.items.map(({ priority: _priority, ...item }) => item),
});

const hydrateResult = (result) =>
    result == null
        ? result
        : {
              ...result,
              items: result.items.map((item, index) => ({ ...item, priority: index + 1 })),
          };

const operationFromRow = (row) =>
    row
        ? {
              id: row.id,
              operationId: row.id,
              channelHubAccountId: row.channel_hub_account_id,
              accountId: row.channel_hub_account_id,
              revision: row.revision,
              orderedWorkspaceIds: row.ordered_workspace_ids,
              status: row.status,
              attemptCount: Number(row.attempt_count),
              result: hydrateResult(row.result),
              error:
                  row.error_code || row.error_message
                      ? { code: row.error_code ?? null, message: row.error_message ?? null }
                      : null,
              errorCode: row.error_code ?? null,
              errorMessage: row.error_message ?? null,
              startedAt: row.started_at ?? null,
              completedAt: row.completed_at ?? null,
              validatedAt: row.validated_at ?? null,
              leaseOwnerId: row.lease_owner_id ?? null,
              heartbeatAt: row.heartbeat_at ?? null,
              leaseExpiresAt: row.lease_expires_at ?? null,
              createdAt: row.created_at,
              createdBy: row.created_by ?? null,
              updatedAt: row.updated_at,
              updatedBy: row.updated_by ?? null,
          }
        : null;

const publicationFromRow = (row) => ({
    operationId: row.operation_id,
    eventId: row.event_id,
    event: row.event,
    publishAttemptCount: Number(row.publish_attempt_count),
    lastAttemptAt: row.last_attempt_at ?? null,
    nextAttemptAt: row.next_attempt_at,
    claimOwnerId: row.claim_owner_id ?? null,
    claimExpiresAt: row.claim_expires_at ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
});

const safeError = (error) => {
    const status = Number(error?.statusCode ?? error?.upstreamStatus ?? 0);
    const explicitCode = normalizePublicErrorCode(error?.publicErrorCode) ?? null;
    const statusCode =
        status === 400
            ? BAD_REQUEST_ERROR
            : status === 404
              ? NOT_FOUND_ERROR
              : status === 409
                ? CONFLICT_ERROR
                : error?.name === 'ChannelHubMailRulesRestFlowError'
                  ? CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE
                  : CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED;
    return {
        code: explicitCode ?? statusCode,
        message: 'Workspace priority reorder failed',
    };
};

const isActiveOperationConflict = (error) =>
    error?.constraint === ACTIVE_INDEX ||
    (error?.code === '23505' && String(error?.detail ?? error?.message).includes('channel_hub_account_id'));

export const serializeChannelHubWorkspacePriorityReorderStatus = (operation) => ({
    operationId: operation.operationId,
    status: operation.status,
    attemptCount: operation.attemptCount,
    result: operation.result,
    error: operation.error,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
});

export class KnexChannelHubWorkspacePriorityReorderRepository extends KnexRepository {
    constructor(writerConfig, readerConfig = null) {
        if (writerConfig?.client !== 'pg' || !writerConfig.connection) {
            throw new Error('KnexChannelHubWorkspacePriorityReorderRepository requires a tenant writer config');
        }
        super(writerConfig, TABLE, readerConfig);
    }

    async create({ operationId, accountId, revision, orderedWorkspaceIds, requestedBy = null, event = null }) {
        try {
            DbRequestContext.markWrite();
            const now = new Date();
            await this.writer.transaction(async (trx) => {
                await this.trxTable(trx).insert({
                    id: operationId,
                    channel_hub_account_id: accountId,
                    revision,
                    ordered_workspace_ids: JSON.stringify(orderedWorkspaceIds),
                    status: 'pending',
                    attempt_count: 0,
                    created_at: now,
                    created_by: requestedBy,
                    updated_at: now,
                    updated_by: requestedBy,
                });
                if (event) {
                    const serializedEvent = event.toJson();
                    await this.trxTable(trx, OUTBOX_TABLE).insert({
                        operation_id: operationId,
                        event_id: serializedEvent.eventId,
                        event: JSON.stringify(serializedEvent),
                        created_at: now,
                        next_attempt_at: now,
                    });
                }
            });
            return this.findById(operationId);
        } catch (error) {
            if (isActiveOperationConflict(error)) {
                const activeOperation = await this.findActiveByAccountId(accountId);
                throw new ChannelHubWorkspacePriorityReorderConflict(activeOperation);
            }
            throw error;
        }
    }

    async findActiveByAccountId(accountId) {
        const row = await this.table()
            .where({ channel_hub_account_id: accountId })
            .whereIn('status', ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES)
            .orderBy('created_at', 'asc')
            .first();
        return operationFromRow(row);
    }

    async findById(operationId) {
        // Receipt/status polling is writer-bound so a POST response and subsequent
        // cross-request polls cannot move backwards through replica lag.
        const row = await this.table().where({ id: operationId }).first();
        return operationFromRow(row);
    }

    async claim(operationId, { ownerId, leaseDurationMs, now = new Date() }) {
        DbRequestContext.markWrite();
        const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
        const rows = await this.table()
            .where({ id: operationId })
            .where((query) => {
                query.where({ status: 'pending' }).orWhere((expired) => {
                    expired.where({ status: 'in_progress' }).where('lease_expires_at', '<=', now);
                });
            })
            .update({
                status: 'in_progress',
                attempt_count: this.writer.raw('attempt_count + 1'),
                started_at: this.writer.raw('coalesce(started_at, ?)', [now]),
                lease_owner_id: ownerId,
                heartbeat_at: now,
                lease_expires_at: leaseExpiresAt,
                updated_at: now,
                error_code: null,
                error_message: null,
            })
            .returning('*');
        return operationFromRow(rows[0]);
    }

    async heartbeat(operationId, { ownerId, leaseDurationMs, now = new Date() }) {
        DbRequestContext.markWrite();
        const rows = await this.table()
            .where({ id: operationId, status: 'in_progress', lease_owner_id: ownerId })
            .update({
                heartbeat_at: now,
                lease_expires_at: new Date(now.getTime() + leaseDurationMs),
                updated_at: now,
            })
            .returning('*');
        return operationFromRow(rows[0]);
    }

    async markValidated(operationId, { ownerId, now = new Date() }) {
        DbRequestContext.markWrite();
        const rows = await this.table()
            .where({ id: operationId, status: 'in_progress', lease_owner_id: ownerId })
            .update({ validated_at: now, updated_at: now })
            .returning('*');
        return operationFromRow(rows[0]);
    }

    async markCompleted(operationId, result, { ownerId = null } = {}) {
        DbRequestContext.markWrite();
        const now = new Date();
        const query = this.table().where({ id: operationId });
        if (ownerId) {
            query.where({ status: 'in_progress', lease_owner_id: ownerId });
        } else {
            query.where({ status: 'pending' }).whereNull('lease_owner_id');
        }
        const rows = await query
            .update({
                status: 'completed',
                result: JSON.stringify(resultForPersistence(result)),
                error_code: null,
                error_message: null,
                completed_at: now,
                updated_at: now,
                lease_owner_id: null,
                heartbeat_at: null,
                lease_expires_at: null,
            })
            .returning('*');
        return operationFromRow(rows[0]);
    }

    async markFailed(operationId, error, { incrementAttempt = false, ownerId = null } = {}) {
        DbRequestContext.markWrite();
        const now = new Date();
        const sanitized = safeError(error);
        const update = {
            status: 'failed',
            error_code: sanitized.code,
            error_message: sanitized.message,
            completed_at: now,
            updated_at: now,
            lease_owner_id: null,
            heartbeat_at: null,
            lease_expires_at: null,
        };
        if (incrementAttempt) update.attempt_count = this.writer.raw('attempt_count + 1');
        const query = this.table().where({ id: operationId });
        if (ownerId) {
            query.where({ status: 'in_progress', lease_owner_id: ownerId });
        } else {
            query.where({ status: 'pending' }).whereNull('lease_owner_id');
        }
        const rows = await query.update(update).returning('*');
        return operationFromRow(rows[0]);
    }

    async findPendingPublications({ accountId = null, limit = 100 } = {}) {
        // This scan is advisory; claiming rechecks eligibility under a writer transaction.
        const query = this.read
            .table(OUTBOX_TABLE)
            .select(`${OUTBOX_TABLE}.*`)
            .join(TABLE, `${TABLE}.id`, `${OUTBOX_TABLE}.operation_id`)
            .whereNull(`${OUTBOX_TABLE}.published_at`)
            .whereIn(`${TABLE}.status`, ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES)
            .orderBy(`${OUTBOX_TABLE}.created_at`, 'asc')
            .limit(limit);
        if (accountId) query.where(`${TABLE}.channel_hub_account_id`, accountId);
        return (await query).map(publicationFromRow);
    }

    async claimPendingPublications({ ownerId, leaseDurationMs, now = new Date(), limit = 25 }) {
        DbRequestContext.markWrite();
        return this.writer.transaction(async (trx) => {
            const dueRows = await this.trxTable(trx, OUTBOX_TABLE)
                .select(`${OUTBOX_TABLE}.operation_id`)
                .join(TABLE, `${TABLE}.id`, `${OUTBOX_TABLE}.operation_id`)
                .whereNull(`${OUTBOX_TABLE}.published_at`)
                .whereIn(`${TABLE}.status`, ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES)
                .where(`${OUTBOX_TABLE}.next_attempt_at`, '<=', now)
                .where((query) => query.whereNull('claim_expires_at').orWhere('claim_expires_at', '<=', now))
                .orderBy(`${OUTBOX_TABLE}.created_at`, 'asc')
                .limit(limit)
                .forUpdate()
                .skipLocked();
            if (dueRows.length === 0) return [];

            const operationIds = dueRows.map(({ operation_id: operationId }) => operationId);
            const rows = await this.trxTable(trx, OUTBOX_TABLE)
                .whereIn('operation_id', operationIds)
                .update({
                    claim_owner_id: ownerId,
                    claim_expires_at: new Date(now.getTime() + leaseDurationMs),
                    last_attempt_at: now,
                    publish_attempt_count: trx.raw('publish_attempt_count + 1'),
                })
                .returning('*');
            return rows.map(publicationFromRow);
        });
    }

    async claimPublication(operationId, { ownerId, leaseDurationMs, now = new Date() }) {
        DbRequestContext.markWrite();
        const rows = await this.table(OUTBOX_TABLE)
            .where({ operation_id: operationId })
            .whereNull('published_at')
            .where('next_attempt_at', '<=', now)
            .where((query) => query.whereNull('claim_expires_at').orWhere('claim_expires_at', '<=', now))
            .update({
                claim_owner_id: ownerId,
                claim_expires_at: new Date(now.getTime() + leaseDurationMs),
                last_attempt_at: now,
                publish_attempt_count: this.writer.raw('publish_attempt_count + 1'),
            })
            .returning('*');
        return rows[0] ? publicationFromRow(rows[0]) : null;
    }

    async markPublicationPublished(operationId, { eventId, ownerId, now = new Date() }) {
        DbRequestContext.markWrite();
        const rows = await this.table(OUTBOX_TABLE)
            .where({ operation_id: operationId, event_id: eventId, claim_owner_id: ownerId })
            .whereNull('published_at')
            .update({ published_at: now, claim_owner_id: null, claim_expires_at: null })
            .returning('*');
        return rows[0] ? publicationFromRow(rows[0]) : null;
    }

    async releasePublicationClaim(operationId, { ownerId, nextAttemptAt }) {
        DbRequestContext.markWrite();
        const rows = await this.table(OUTBOX_TABLE)
            .where({ operation_id: operationId, claim_owner_id: ownerId })
            .whereNull('published_at')
            .update({ claim_owner_id: null, claim_expires_at: null, next_attempt_at: nextAttemptAt })
            .returning('*');
        return rows[0] ? publicationFromRow(rows[0]) : null;
    }
}
