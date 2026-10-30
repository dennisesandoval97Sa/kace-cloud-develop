import { ChannelHubAccount } from '../../domain/ChannelHubAccount.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexChannelHubAccountRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'channel_hub_accounts', readerConfig);
    }

    async save(account) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: account.id.value,
                email: account.email.value,
                name: account.name.value,
                country_id: account.country_id.value,
                operator_id: account.operator_id.value,
                rest_flow_id: account.rest_flow_id.value,
                mail_rule_list_rest_flow_id: account.mail_rule_list_rest_flow_id.value,
                mail_rule_priority_update_rest_flow_id: account.mail_rule_priority_update_rest_flow_id.value,
                channel_hub_connection_id: account.channel_hub_connection_id.value,
                is_active: account.is_active.value,
                created_at: account.created_at.value,
                created_by: account.created_by.value,
                updated_at: account.updated_at.value,
                updated_by: account.updated_by.value,
                channel_hub_error: account.channel_hub_error.value
                    ? JSON.stringify(account.channel_hub_error.value)
                    : null,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const result = await this.read
                .table(this.tableName)
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first('*');
            return !result ? null : new ChannelHubAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async update(account) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .where({ id: account.id.value })
                .update({
                    name: account.name.value,
                    country_id: account.country_id.value,
                    operator_id: account.operator_id.value,
                    rest_flow_id: account.rest_flow_id.value,
                    mail_rule_list_rest_flow_id: account.mail_rule_list_rest_flow_id.value,
                    mail_rule_priority_update_rest_flow_id: account.mail_rule_priority_update_rest_flow_id.value,
                    channel_hub_connection_id: account.channel_hub_connection_id.value,
                    is_active: account.is_active.value,
                    updated_at: account.updated_at.value,
                    updated_by: account.updated_by.value,
                    channel_hub_error: account.channel_hub_error.value
                        ? JSON.stringify(account.channel_hub_error.value)
                        : null,
                });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('update');
        }
    }

    async delete(account) {
        try {
            DbRequestContext.markWrite();
            await this.table().where({ id: account.id.value }).update({
                deleted_at: account.deleted_at.value,
                deleted_by: account.deleted_by.value,
                updated_at: account.updated_at.value,
                updated_by: account.updated_by.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('delete');
        }
    }

    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const rows = await queryBuilder;
            return rows.map((row) => new ChannelHubAccount(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).count('* as count');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const rows = await queryBuilder;
            return rows[0].count;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('count');
        }
    }

    async findByEmail(email) {
        try {
            const result = await this.read.table(this.tableName).where({ email }).whereNull('deleted_at').first();
            return !result ? null : new ChannelHubAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByEmail');
        }
    }

    async findByConnectionId(connectionId) {
        try {
            const normalized = String(connectionId ?? '').trim();

            if (!normalized) {
                return null;
            }

            const result = await this.read
                .table(this.tableName)
                .where({ channel_hub_connection_id: normalized })
                .whereNull('deleted_at')
                .first();
            return !result ? null : new ChannelHubAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByConnectionId');
        }
    }

    async findAllByEmails(emailAddresses) {
        try {
            const normalized = [...new Set((emailAddresses ?? []).filter(Boolean).map((email) => email.toLowerCase()))];

            if (normalized.length === 0) {
                return [];
            }

            const rows = await this.read
                .table(this.tableName)
                .whereNull('deleted_at')
                .whereIn(this.read.raw('lower(email)'), normalized);

            return rows.map((row) => new ChannelHubAccount(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findAllByEmails');
        }
    }

    async updateConnectionId(id, connectionId, error, updatedAt, updatedBy) {
        try {
            DbRequestContext.markWrite();
            const affectedRows = await this.table()
                .where({ id })
                .whereNull('channel_hub_connection_id')
                .update({
                    channel_hub_connection_id: connectionId,
                    channel_hub_error: error ? JSON.stringify(error) : null,
                    updated_at: updatedAt,
                    updated_by: updatedBy,
                });
            return affectedRows;
        } catch (err) {
            Helper.logError(err.message, err);
            throw new QueryDBError('updateConnectionId');
        }
    }
}
