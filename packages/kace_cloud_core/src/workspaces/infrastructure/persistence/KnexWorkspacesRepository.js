import { Helper, KnexRepository } from '../../../shared/index.js';
import { Workspaces } from '../../domain/Workspaces.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { applyActiveGroupWorkspaceScope } from '../../../shared/infrastructure/persistence/ActiveGroupWorkspaceScope.js';
import { SYSTEM_INBOX_WORKSPACE_ID } from '../../domain/SystemInboxWorkspace.js';

export { SYSTEM_INBOX_WORKSPACE_ID as DEFAULT_INBOX_WORKSPACE_ID } from '../../domain/SystemInboxWorkspace.js';

export class KnexWorkspacesRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'workspaces', readerConfig);
        this.relationsTable = 'workspaces_mail_accounts_relations';
        this.channelHubRelationsTable = 'workspaces_channel_hub_accounts_relations';
        this.relationsTableGrupos = 'workspaces_grupos_relations';
    }

    relationId(relation) {
        return typeof relation === 'string' ? relation : relation?.id;
    }

    relationRows(workspaceId, relations, relationColumn, extraColumns = {}) {
        return relations
            .map((relation) => ({ relationId: this.relationId(relation), relation }))
            .filter(({ relationId }) => Boolean(relationId))
            .map(({ relationId, relation }) => {
                const row = {
                    workspace_id: workspaceId,
                    [relationColumn]: relationId,
                };
                for (const [column, accessor] of Object.entries(extraColumns)) {
                    row[column] = accessor(relation);
                }
                return row;
            });
    }

    channelHubRuleId(relation) {
        return relation && typeof relation === 'object' ? (relation.channel_hub_rule_id ?? null) : null;
    }

    channelHubRelationRows(workspaceId, relations) {
        return this.relationRows(workspaceId, relations, 'channel_hub_account_id', {
            channel_hub_rule_id: (relation) => this.channelHubRuleId(relation),
        });
    }

    /**
     *
     * @param {object} dto data for insert
     * @returns {Promise<void>}
     */
    async save(dto) {
        // save() drives the transaction directly (bypasses the base auto-markWrite),
        // so mark the write explicitly to keep subsequent reads on the writer.
        DbRequestContext.markWrite();
        const trxProvider = this.connection.transactionProvider();
        const trx = await trxProvider();
        try {
            await this.trxTable(trx, this.tableName).insert({
                id: dto.id.value,
                description: dto.description.value,
                is_active: dto.is_active.value,
                tag: dto.tag.value,
                rules: dto.rules?.value ? JSON.stringify(dto.rules.value) : null,
                tag_creation_flow_id: dto.tag_creation_flow_id.value,
                tag_update_flow_id: dto.tag_update_flow_id.value,
                tag_deletion_flow_id: dto.tag_deletion_flow_id.value,
                created_by: dto.created_by.value,
                created_at: dto.created_at.value,
            });

            if (Array.isArray(dto.mails_accounts?.value) && dto.mails_accounts.value.length > 0) {
                const rows = this.relationRows(dto.id.value, dto.mails_accounts.value, 'mail_account_id');
                if (rows.length > 0) await this.trxTable(trx, this.relationsTable).insert(rows);
            }

            if (Array.isArray(dto.channel_hub_accounts?.value) && dto.channel_hub_accounts.value.length > 0) {
                const rows = this.channelHubRelationRows(dto.id.value, dto.channel_hub_accounts.value);
                if (rows.length > 0) await this.trxTable(trx, this.channelHubRelationsTable).insert(rows);
            }

            if (Array.isArray(dto.groups?.value) && dto.groups.value.length > 0) {
                const rows = this.relationRows(dto.id.value, dto.groups.value, 'grupo_id');
                if (rows.length > 0) await this.trxTable(trx, this.relationsTableGrupos).insert(rows);
            }
            await trx.commit();
        } catch (error) {
            await trx.rollback();
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Workspaces>}
     * @throws {CustomError}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value, deleted_at: null }).first('*');

            if (!result) {
                return null;
            }

            const mailsAccounts = await this.table(this.relationsTable)
                .leftJoin(
                    this.qualifiedName('mail_accounts'),
                    `${this.relationsTable}.mail_account_id`,
                    'mail_accounts.id'
                )
                .where({ [`${this.relationsTable}.workspace_id`]: id.value })
                .whereNull('mail_accounts.deleted_at')
                .select('mail_accounts.*');

            const groups = await this.table(this.relationsTableGrupos)
                .leftJoin(this.qualifiedName('grupos'), `${this.relationsTableGrupos}.grupo_id`, 'grupos.id')
                .where({ [`${this.relationsTableGrupos}.workspace_id`]: id.value })
                .whereNull('grupos.deleted_at')
                .select('grupos.*');

            const channelHubAccounts = await this.table(this.channelHubRelationsTable)
                .leftJoin(
                    this.qualifiedName('channel_hub_accounts'),
                    `${this.channelHubRelationsTable}.channel_hub_account_id`,
                    'channel_hub_accounts.id'
                )
                .where({ [`${this.channelHubRelationsTable}.workspace_id`]: id.value })
                .whereNull('channel_hub_accounts.deleted_at')
                .select('channel_hub_accounts.*', `${this.channelHubRelationsTable}.channel_hub_rule_id`);

            result.mails_accounts = mailsAccounts;
            result.channel_hub_accounts = channelHubAccounts;
            result.groups = groups;

            return new Workspaces(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    async findActiveById(workspaceId) {
        try {
            const idValue = typeof workspaceId === 'string' ? workspaceId : workspaceId?.value;
            const result = await this.table()
                .where({ id: idValue, deleted_at: null })
                .where((builder) => {
                    builder.where('is_active', true).orWhere('is_active', 1);
                })
                .first('*');

            return !result
                ? null
                : new Workspaces({ ...result, mails_accounts: [], channel_hub_accounts: [], groups: [] });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findActiveById');
        }
    }

    async findActiveByTag(tag) {
        try {
            const tagValue = typeof tag === 'string' ? tag : tag?.value;
            const result = await this.table()
                .where({ tag: tagValue, deleted_at: null })
                .where((builder) => {
                    builder.where('is_active', true).orWhere('is_active', 1);
                })
                .first('*');

            return !result
                ? null
                : new Workspaces({ ...result, mails_accounts: [], channel_hub_accounts: [], groups: [] });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findActiveByTag');
        }
    }

    async findDefaultInboxWorkspace() {
        return this.findActiveById(SYSTEM_INBOX_WORKSPACE_ID);
    }

    async findActiveByChannelHubAccountIdAndTag(channelHubAccountId, tag) {
        try {
            const accountId =
                typeof channelHubAccountId === 'string' ? channelHubAccountId : channelHubAccountId?.value;
            const tagValue = typeof tag === 'string' ? tag.trim() : tag?.value;

            if (!accountId || !tagValue) {
                return [];
            }

            const rows = await this.table(this.channelHubRelationsTable)
                .innerJoin(
                    this.qualifiedName(this.tableName),
                    `${this.channelHubRelationsTable}.workspace_id`,
                    `${this.tableName}.id`
                )
                .where({
                    [`${this.channelHubRelationsTable}.channel_hub_account_id`]: accountId,
                    [`${this.tableName}.tag`]: tagValue,
                })
                .whereNull(`${this.tableName}.deleted_at`)
                .where((builder) => {
                    builder.where(`${this.tableName}.is_active`, true).orWhere(`${this.tableName}.is_active`, 1);
                })
                .select(`${this.tableName}.*`)
                .orderBy(`${this.tableName}.description`, 'asc')
                .orderBy(`${this.tableName}.id`, 'asc');

            return rows.map(
                (row) => new Workspaces({ ...row, mails_accounts: [], channel_hub_accounts: [], groups: [] })
            );
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findActiveByChannelHubAccountIdAndTag');
        }
    }

    async findChannelHubPriorityMappingsByAccountId(channelHubAccountId) {
        try {
            if (!channelHubAccountId) return [];

            return await this.read
                .table(this.channelHubRelationsTable)
                .innerJoin(
                    this.qualifiedName(this.tableName),
                    `${this.channelHubRelationsTable}.workspace_id`,
                    `${this.tableName}.id`
                )
                .where({
                    [`${this.channelHubRelationsTable}.channel_hub_account_id`]: channelHubAccountId,
                })
                .whereNull(`${this.tableName}.deleted_at`)
                .where((builder) => {
                    builder.where(`${this.tableName}.is_active`, true).orWhere(`${this.tableName}.is_active`, 1);
                })
                .select({
                    workspaceId: `${this.tableName}.id`,
                    description: `${this.tableName}.description`,
                    tag: `${this.tableName}.tag`,
                    ruleId: `${this.channelHubRelationsTable}.channel_hub_rule_id`,
                })
                .orderBy(`${this.tableName}.description`, 'asc')
                .orderBy(`${this.tableName}.id`, 'asc');
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findChannelHubPriorityMappingsByAccountId');
        }
    }

    async hasMailAccount(workspaceId, mailAccountId) {
        try {
            const result = await this.table(this.relationsTable)
                .where({
                    workspace_id: typeof workspaceId === 'string' ? workspaceId : workspaceId?.value,
                    mail_account_id: typeof mailAccountId === 'string' ? mailAccountId : mailAccountId?.value,
                })
                .first('*');

            return Boolean(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('hasMailAccount');
        }
    }

    async hasChannelHubAccount(workspaceId, channelHubAccountId) {
        try {
            const result = await this.table(this.channelHubRelationsTable)
                .where({
                    workspace_id: typeof workspaceId === 'string' ? workspaceId : workspaceId?.value,
                    channel_hub_account_id:
                        typeof channelHubAccountId === 'string' ? channelHubAccountId : channelHubAccountId?.value,
                })
                .first('*');

            return Boolean(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('hasChannelHubAccount');
        }
    }

    async countNonDeletedChannelHubAccounts(channelHubAccountIds) {
        try {
            const ids = [...new Set((channelHubAccountIds ?? []).filter(Boolean))];
            if (ids.length === 0) {
                return 0;
            }

            const result = await this.table('channel_hub_accounts')
                .whereIn('id', ids)
                .whereNull('deleted_at')
                .countDistinct({ count: 'id' })
                .first();

            return Number(result?.count ?? 0);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('countNonDeletedChannelHubAccounts');
        }
    }

    /**
     * Returns active workspaces belonging to the authenticated user's valid,
     * persisted active-group scope. This authorization-sensitive read always
     * uses the writer.
     * @param {{userId: string, activeGroupId: string}} scope
     * @returns {Promise<Workspaces[]>}
     * @throws {CustomError}
     */
    async searchAvailableForActiveGroup({ userId, activeGroupId } = {}) {
        try {
            const query = this.table().select(`${this.tableName}.*`);
            applyActiveGroupWorkspaceScope(query, {
                userId,
                activeGroupId,
                workspaceIdColumn: `${this.tableName}.id`,
                schema: this.schema,
            });
            const rows = await query.orderBy(`${this.tableName}.description`, 'asc');

            return rows.map(
                (row) => new Workspaces({ ...row, mails_accounts: [], channel_hub_accounts: [], groups: [] })
            );
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('searchAvailableForActiveGroup');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Workspaces[]>}
     * @throws {CustomError}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('workspaces').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            if (rows.length === 0) {
                return [];
            }

            const workspaceIds = rows.map((row) => row.id);
            const relations = await this.read
                .table(this.relationsTable)
                .leftJoin(
                    this.qualifiedName('mail_accounts'),
                    `${this.relationsTable}.mail_account_id`,
                    'mail_accounts.id'
                )
                .whereIn(`${this.relationsTable}.workspace_id`, workspaceIds)
                .whereNull('mail_accounts.deleted_at')
                .select(`${this.relationsTable}.workspace_id`, 'mail_accounts.*');

            const groupRelations = await this.read
                .table(this.relationsTableGrupos)
                .leftJoin(this.qualifiedName('grupos'), `${this.relationsTableGrupos}.grupo_id`, 'grupos.id')
                .whereIn(`${this.relationsTableGrupos}.workspace_id`, workspaceIds)
                .whereNull('grupos.deleted_at')
                .select(`${this.relationsTableGrupos}.workspace_id`, 'grupos.*');

            const channelHubRelations = await this.table(this.channelHubRelationsTable)
                .leftJoin(
                    this.qualifiedName('channel_hub_accounts'),
                    `${this.channelHubRelationsTable}.channel_hub_account_id`,
                    'channel_hub_accounts.id'
                )
                .whereIn(`${this.channelHubRelationsTable}.workspace_id`, workspaceIds)
                .whereNull('channel_hub_accounts.deleted_at')
                .select(
                    `${this.channelHubRelationsTable}.workspace_id`,
                    'channel_hub_accounts.*',
                    `${this.channelHubRelationsTable}.channel_hub_rule_id`
                );

            const mailsAccountsByWorkspace = new Map();
            for (const rel of relations) {
                const { workspace_id, ...mailAccount } = rel;
                const arr = mailsAccountsByWorkspace.get(workspace_id) ?? [];
                arr.push(mailAccount);
                mailsAccountsByWorkspace.set(workspace_id, arr);
            }

            const groupsByWorkspace = new Map();
            for (const rel of groupRelations) {
                const { workspace_id, ...group } = rel;
                const arr = groupsByWorkspace.get(workspace_id) ?? [];
                arr.push(group);
                groupsByWorkspace.set(workspace_id, arr);
            }

            const channelHubAccountsByWorkspace = new Map();
            for (const rel of channelHubRelations) {
                const { workspace_id, ...channelHubAccount } = rel;
                const arr = channelHubAccountsByWorkspace.get(workspace_id) ?? [];
                arr.push(channelHubAccount);
                channelHubAccountsByWorkspace.set(workspace_id, arr);
            }

            return rows.map((row) => {
                row.mails_accounts = mailsAccountsByWorkspace.get(row.id) ?? [];
                row.channel_hub_accounts = channelHubAccountsByWorkspace.get(row.id) ?? [];
                row.groups = groupsByWorkspace.get(row.id) ?? [];
                return new Workspaces(row);
            });
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts workspaces matching the criteria. Read-only list counter routed to the replica.
     * @param {Criteria} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('workspaces').count());
            query.whereNull('workspaces.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Actualiza un workspace incluyendo sus relaciones de mails_accounts
     * @param {Workspaces} aggregate
     * @returns {Promise<void>}
     */
    async update(aggregate, { clearChannelHubRuleIds = false } = {}) {
        const changes = aggregate.changedAttributes;

        // update() drives the transaction directly (bypasses the base auto-markWrite),
        // so mark the write explicitly to keep subsequent reads on the writer.
        DbRequestContext.markWrite();
        const trxProvider = this.connection.transactionProvider();
        const trx = await trxProvider();

        try {
            const id = aggregate.id.value;

            const scalarKeys = [
                'description',
                'is_active',
                'tag',
                'rules',
                'tag_creation_flow_id',
                'tag_update_flow_id',
                'tag_deletion_flow_id',
                'updated_at',
                'updated_by',
                'deleted_at',
                'deleted_by',
            ];
            const scalar = {};
            for (const k of scalarKeys) {
                if (!Object.prototype.hasOwnProperty.call(changes, k)) continue;
                if (k === 'rules') {
                    scalar[k] = changes[k] ? JSON.stringify(changes[k]) : null;
                } else {
                    scalar[k] = changes[k];
                }
            }

            const hasMailsAccounts = Object.prototype.hasOwnProperty.call(changes, 'mails_accounts');
            const hasChannelHubAccounts = Object.prototype.hasOwnProperty.call(changes, 'channel_hub_accounts');
            const hasGroups = Object.prototype.hasOwnProperty.call(changes, 'groups');

            if (Object.keys(scalar).length > 0) {
                await this.trxTable(trx, this.tableName).update(scalar).where({ id }).whereNull('deleted_at');
            }

            if (hasMailsAccounts) {
                await this.trxTable(trx, this.relationsTable).where({ workspace_id: id }).del();

                const mailsAccounts = changes.mails_accounts ?? [];
                if (Array.isArray(mailsAccounts) && mailsAccounts.length > 0) {
                    const rows = this.relationRows(id, mailsAccounts, 'mail_account_id');
                    if (rows.length > 0) await this.trxTable(trx, this.relationsTable).insert(rows);
                }
            }

            if (hasChannelHubAccounts) {
                // Capture the existing rule id per account BEFORE the delete-all+reinsert so a
                // retained account keeps its rule id when the caller does not resend it.
                const existingRelations = await this.trxTable(trx, this.channelHubRelationsTable)
                    .where({ workspace_id: id })
                    .select('channel_hub_account_id', 'channel_hub_rule_id');
                const existingRuleIdByAccount = new Map(
                    existingRelations.map((row) => [row.channel_hub_account_id, row.channel_hub_rule_id])
                );

                await this.trxTable(trx, this.channelHubRelationsTable).where({ workspace_id: id }).del();

                const channelHubAccounts = changes.channel_hub_accounts ?? [];
                if (Array.isArray(channelHubAccounts) && channelHubAccounts.length > 0) {
                    const rows = this.channelHubRelationRows(id, channelHubAccounts).map((row) => ({
                        ...row,
                        channel_hub_rule_id:
                            row.channel_hub_rule_id ?? existingRuleIdByAccount.get(row.channel_hub_account_id) ?? null,
                    }));
                    if (rows.length > 0) await this.trxTable(trx, this.channelHubRelationsTable).insert(rows);
                }
            }

            if (clearChannelHubRuleIds) {
                await this.trxTable(trx, this.channelHubRelationsTable)
                    .where({ workspace_id: id })
                    .update({ channel_hub_rule_id: null });
            }

            if (hasGroups) {
                await this.trxTable(trx, this.relationsTableGrupos).where({ workspace_id: id }).del();

                const groups = changes.groups ?? [];
                if (Array.isArray(groups) && groups.length > 0) {
                    const rows = this.relationRows(id, groups, 'grupo_id');
                    if (rows.length > 0) await this.trxTable(trx, this.relationsTableGrupos).insert(rows);
                }
            }

            await trx.commit();
        } catch (error) {
            await trx.rollback();
            Helper.logError('Error updating workspace:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Persist an inactive workspace and clear every remote Channel Hub rule mapping
     * in the same transaction. Callers must confirm remote deletion first.
     */
    async deactivate(aggregate) {
        return this.update(aggregate, { clearChannelHubRuleIds: true });
    }
}
