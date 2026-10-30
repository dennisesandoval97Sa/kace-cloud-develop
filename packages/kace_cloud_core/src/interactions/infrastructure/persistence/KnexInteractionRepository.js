import { v4 as uuidV4 } from 'uuid';
import { Helper, KnexRepository } from '../../../shared/index.js';
import { Interaction } from '../../domain/Interaction.js';
import { SYSTEM_INBOX_WORKSPACE_ID } from '../../../workspaces/domain/SystemInboxWorkspace.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { applyActiveGroupWorkspaceScope } from '../../../shared/infrastructure/persistence/ActiveGroupWorkspaceScope.js';
import { applyAdminActiveWorkspaceScope } from '../../../shared/infrastructure/persistence/adminActiveWorkspaceScope.js';

function valueFromRow(row, fieldName) {
    const rawValue = row?.[fieldName];
    return rawValue?.value ?? rawValue ?? null;
}

function uniqueLinkedEmailIds(interactions) {
    return [
        ...new Set((interactions ?? []).map((interaction) => valueFromRow(interaction, 'email_id')).filter(Boolean)),
    ];
}

const emailIdValue = (emailId) => emailId?.value ?? (emailId?.constructor === String ? emailId : undefined);

const applyLiveInteractionScope = (queryBuilder) =>
    queryBuilder.whereNull('interactions.deleted_at').whereNull('interactions.deleted_by');

export class KnexInteractionRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'interactions', readerConfig);
    }

    #queryTable({ trx, table = this.tableName } = {}) {
        return trx ? this.trxTable(trx, table) : this.table(table);
    }

    /**
     *
     * @param {Interaction} interaction data for insert
     * @param {import('knex').Knex.Transaction|null} trx optional transaction to run the insert on
     * @returns {Promise<void>}
     */
    async save(interaction, trx = null) {
        try {
            DbRequestContext.markWrite();
            await this.#queryTable({ trx }).insert({
                id: interaction.id.value,
                channel_id: interaction.channel_id.value,
                client_identifier: interaction.client_identifier.value,
                external_identifier: interaction.external_identifier.value,
                description: interaction.description.value,
                priority: interaction.priority.value,
                workspace_id: interaction.workspace_id.value,
                email_id: interaction.email_id.value,
                start_review_at: interaction.start_review_at.value,
                start_review_by: interaction.start_review_by.value,
                in_review: interaction.in_review.value ?? false,
                conversation_id: interaction.conversation_id.value,
                receipt_at: interaction.receipt_at.value,
                closed_at: interaction.closed_at.value,
                closed_by: interaction.closed_by.value,
                is_closed: interaction.is_closed.value ?? false,
                closed_observation: interaction.closed_observation.value,
                delete_observation: interaction.delete_observation.value,
                is_migrated: interaction.is_migrated.value,
                created_by: interaction.created_by.value,
                created_at: interaction.created_at.value,
            });
        } catch (error) {
            if (
                error?.constraint === 'interactions_email_id_unique' ||
                /interactions_email_id_unique/i.test(error?.message ?? '') ||
                (/unique/i.test(error?.message ?? '') && /email_id/i.test(error?.message ?? ''))
            ) {
                throw error;
            }
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Interaction>}
     * @throws {CustomError}
     */
    async find(id) {
        try {
            const result = await this.read.table('interactions').where({ id: id.value, deleted_at: null }).first('*');
            return !result ? null : Interaction.reconstitute(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {string|ValueObjectUuid} emailId
     * @param {{trx?: import('knex').Knex.Transaction}} [options] when a transaction is given the read runs on it,
     *   so callers inside a transaction see their own uncommitted rows.
     * @returns {Promise<Interaction|null>}
     */
    async findByEmailId(emailId, { trx } = {}) {
        try {
            const value = emailIdValue(emailId);
            const result = await this.#queryTable({ trx })
                .where({ email_id: value })
                .whereNull('deleted_at')
                .first('*');

            return !result ? null : Interaction.reconstitute(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByEmailId');
        }
    }

    /**
     * Batch counterpart of findByEmailId: resolves every linked email of a batch in a single query.
     *
     * @param {Array<string|ValueObjectUuid>} emailIds
     * @param {{trx?: import('knex').Knex.Transaction}} [options]
     * @returns {Promise<Interaction[]>} the interactions already linked to any of the given emails.
     */
    async findByEmailIds(emailIds, { trx } = {}) {
        try {
            const values = (emailIds ?? []).map(emailIdValue).filter(Boolean);
            if (values.length === 0) return [];

            const rows = await this.#queryTable({ trx })
                .select('*')
                .whereIn('email_id', values)
                .whereNull('deleted_at');

            return rows.map((row) => Interaction.reconstitute(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByEmailIds');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Interaction[]>}
     * @throws {CustomError}
     */
    async search(criteria, statusOrder = null) {
        try {
            const queryBuilder = this.read.table('interactions').select('*');

            criteria.convertToKnex(queryBuilder);

            applyLiveInteractionScope(queryBuilder);

            if (statusOrder) {
                // Mirror the UI's derived status precedence (is_closed wins over
                // in_review): open (0) < in review (1) < closed (2). The secondary
                // receipt_at order keeps server-side pagination stable within a state.
                queryBuilder.orderByRaw(
                    `CASE WHEN is_closed THEN 2 WHEN in_review THEN 1 ELSE 0 END ${statusOrder.direction}`
                );
                queryBuilder.orderBy('receipt_at', 'desc');
            }

            const rows = await queryBuilder;
            return rows.map((row) => Interaction.reconstitute(row));
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    async searchForAdminActiveWorkspaces(criteria, statusOrder = null) {
        try {
            const queryBuilder = this.read.table('interactions').select('*');

            criteria.convertToKnex(queryBuilder);
            applyLiveInteractionScope(queryBuilder);
            applyAdminActiveWorkspaceScope(queryBuilder, {
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });

            if (statusOrder) {
                queryBuilder.orderByRaw(
                    `CASE WHEN is_closed THEN 2 WHEN in_review THEN 1 ELSE 0 END ${statusOrder.direction}`
                );
                queryBuilder.orderBy('receipt_at', 'desc');
            }

            const rows = await queryBuilder;
            return rows.map((row) => Interaction.reconstitute(row));
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    async searchForActiveGroup(criteria, statusOrder = null, scope = {}) {
        try {
            const queryBuilder = this.table('interactions').select('*');

            criteria.convertToKnex(queryBuilder);
            applyLiveInteractionScope(queryBuilder);
            applyActiveGroupWorkspaceScope(queryBuilder, {
                ...scope,
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });

            if (statusOrder) {
                queryBuilder.orderByRaw(
                    `CASE WHEN is_closed THEN 2 WHEN in_review THEN 1 ELSE 0 END ${statusOrder.direction}`
                );
                queryBuilder.orderBy('receipt_at', 'desc');
            }

            const rows = await queryBuilder;
            return rows.map((row) => Interaction.reconstitute(row));
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    // NOTE: saveHistory is inherited from KnexRepository and is transactional through its
    // third `trx` argument. Any override added here must keep accepting and forwarding it,
    // otherwise batch writes would insert history outside the caller's transaction.

    async findByIds(ids, { trx, forUpdate } = {}) {
        try {
            const query = this.#queryTable({ trx }).select('*').whereIn('id', ids).orderBy('id');
            if (forUpdate) query.forUpdate();
            const rows = await query;
            return rows;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async findByIdsForActiveGroup(ids, scope, { trx, forUpdate } = {}) {
        try {
            const query = this.#queryTable({ trx }).select('*').whereIn('id', ids).orderBy('id');
            applyLiveInteractionScope(query);
            applyActiveGroupWorkspaceScope(query, {
                ...scope,
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });
            if (forUpdate) query.forUpdate();
            return await query;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async findActiveWorkspaceById(workspaceId, { trx } = {}) {
        try {
            return await this.#queryTable({ trx, table: 'workspaces' })
                .select('id')
                .where({ id: workspaceId, is_active: true })
                .whereNull('deleted_at')
                .whereNull('deleted_by')
                .first();
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findActiveWorkspaceById');
        }
    }

    async findActiveWorkspaceByIdForActiveGroup(workspaceId, scope, { trx } = {}) {
        try {
            const query = this.#queryTable({ trx, table: 'workspaces' })
                .select('id')
                .where({ id: workspaceId, is_active: true })
                .whereNull('deleted_at')
                .whereNull('deleted_by');
            applyActiveGroupWorkspaceScope(query, {
                ...scope,
                workspaceIdColumn: 'workspaces.id',
                schema: this.schema,
            });
            return await query.first();
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findActiveWorkspaceById');
        }
    }

    async findEligibleAgentMoveDestinationById(workspaceId, { trx, forUpdate } = {}) {
        try {
            const query = this.#queryTable({ trx, table: 'workspaces' })
                .select('id')
                .where({ id: workspaceId, is_active: true })
                .whereNot('id', SYSTEM_INBOX_WORKSPACE_ID)
                .whereNull('deleted_at')
                .whereNull('deleted_by');
            if (forUpdate) query.forUpdate();
            return (await query.first()) ?? null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findEligibleAgentMoveDestinationById');
        }
    }

    async findEligibleAgentMoveDestinations(currentWorkspaceId) {
        try {
            return await this.table('workspaces')
                .select('id', 'description')
                .where({ is_active: true })
                .whereNot('id', SYSTEM_INBOX_WORKSPACE_ID)
                .whereNot('id', currentWorkspaceId)
                .whereNull('deleted_at')
                .whereNull('deleted_by')
                .orderBy('description', 'asc')
                .orderBy('id', 'asc');
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findEligibleAgentMoveDestinations');
        }
    }

    async #bulkUpdate(interactionIds, values, operationName, { trx } = {}) {
        try {
            await this.#queryTable({ trx }).whereIn('id', interactionIds).update(values);
        } catch (error) {
            Helper.logError(`Error in ${operationName}`, error);
            throw new QueryDBError('update');
        }
    }

    async bulkMove(interactionIds, values, { trx } = {}) {
        return this.#bulkUpdate(interactionIds, values, 'bulkMove', { trx });
    }

    async bulkClose(interactionIds, values, { trx } = {}) {
        return this.#bulkUpdate(interactionIds, values, 'bulkClose', { trx });
    }

    async bulkDelete(interactionIds, values, { trx } = {}) {
        return this.#bulkUpdate(interactionIds, values, 'bulkDelete', { trx });
    }

    async bulkMoveLinkedEmails(interactions, values, { trx } = {}) {
        try {
            const emailIds = uniqueLinkedEmailIds(interactions);
            if (emailIds.length === 0) return 0;

            const updateValues = {
                workspace_id: values.workspace_id,
                updated_at: values.updated_at,
                updated_by: values.updated_by,
            };

            return await this.#queryTable({ trx, table: 'emails' })
                .whereIn('id', emailIds)
                .whereNull('deleted_at')
                .update(updateValues);
        } catch (error) {
            Helper.logError('Error in bulkMoveLinkedEmails', error);
            throw new QueryDBError('bulkMoveLinkedEmails');
        }
    }

    async bulkSoftDeleteLinkedEmailAggregate(interactions, values, { trx } = {}) {
        try {
            const emailIds = uniqueLinkedEmailIds(interactions);
            if (emailIds.length === 0) {
                return { emails: 0, bodies: 0, attachments: 0 };
            }

            const deleteValues = {
                deleted_at: values.deleted_at,
                deleted_by: values.deleted_by,
            };

            const emails = await this.#queryTable({ trx, table: 'emails' })
                .whereIn('id', emailIds)
                .whereNull('deleted_at')
                .update(deleteValues);
            const bodies = await this.#queryTable({ trx, table: 'emails_body' })
                .whereIn('email_id', emailIds)
                .whereNull('deleted_at')
                .update(deleteValues);
            const attachments = await this.#queryTable({ trx, table: 'emails_attachments' })
                .whereIn('email_id', emailIds)
                .whereNull('deleted_at')
                .update(deleteValues);

            return { emails, bodies, attachments };
        } catch (error) {
            Helper.logError('Error in bulkSoftDeleteLinkedEmailAggregate', error);
            throw new QueryDBError('bulkSoftDeleteLinkedEmailAggregate');
        }
    }

    async findByIdForReview(id, { trx, forUpdate } = {}) {
        try {
            const query = this.#queryTable({ trx }).select('*').where({ id }).whereNull('deleted_at').first();
            if (forUpdate) query.forUpdate();
            return (await query) ?? null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByIdForReview');
        }
    }

    async findByIdForActiveGroup(id, scope, { trx, forUpdate } = {}) {
        try {
            const query = this.#queryTable({ trx }).select('*').where({ id });
            applyLiveInteractionScope(query);
            applyActiveGroupWorkspaceScope(query, {
                ...scope,
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });
            if (forUpdate) query.forUpdate();
            return (await query.first()) ?? null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByIdForActiveGroup');
        }
    }

    async updateReviewFields(id, values, { trx } = {}) {
        try {
            return await this.#queryTable({ trx }).where({ id }).whereNull('deleted_at').update(values);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('updateReviewFields');
        }
    }

    async bulkSaveInteractionHistory(interactions, values, { trx } = {}) {
        try {
            if (interactions.length === 0) return;

            const now = new Date().toISOString();
            const records = interactions.map((interaction) => ({
                id: uuidV4(),
                entity_id: interaction.id,
                changed_attributes: JSON.stringify(values),
                new_attributes: JSON.stringify({ ...interaction, ...values }),
                original_attributes: JSON.stringify(interaction),
                created_at: now,
                created_by: values.updated_by ?? values.deleted_by ?? values.closed_by,
            }));

            await this.#queryTable({ trx, table: 'history_interactions' }).insert(records);
        } catch (error) {
            Helper.logError('Error in bulkSaveInteractionHistory', error);
            throw new QueryDBError('bulkSaveInteractionHistory');
        }
    }

    /**
     * Counts interactions matching the criteria. Overrides the base count() to read from the replica.
     * @param {Criteria} criteria
     * @returns {Promise<object>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('interactions').count());
            applyLiveInteractionScope(query);

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }

    async countForAdminActiveWorkspaces(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('interactions').count());
            applyLiveInteractionScope(query);
            applyAdminActiveWorkspaceScope(query, {
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }

    async countForActiveGroup(criteria, scope = {}) {
        try {
            const query = criteria.convertToKnex(this.table('interactions').count());
            applyLiveInteractionScope(query);
            applyActiveGroupWorkspaceScope(query, {
                ...scope,
                workspaceIdColumn: 'interactions.workspace_id',
                schema: this.schema,
            });

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }
}
