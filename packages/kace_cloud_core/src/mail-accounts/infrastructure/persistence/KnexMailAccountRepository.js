import { MailAccount } from '../../domain/MailAccount.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexMailAccountRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'mail_accounts', readerConfig);
    }

    /**
     * Saves the given `MailAccount` instance to the database.
     *
     * @param {MailAccount} mailAccount - The `MailAccount` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `MailAccount` instance is saved.
     *
     */
    async save(mailAccount) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: mailAccount.id.value,
                description: mailAccount.description.value,
                type: mailAccount.type.value,
                host: mailAccount.host.value,
                port: mailAccount.port.value,
                protocol: mailAccount.protocol.value,
                encryption: mailAccount.encryption.value,
                username: mailAccount.username.value,
                password: mailAccount.password.value,
                from_address: mailAccount.from_address.value,
                from_name: mailAccount.from_name.value,
                tenant_id: mailAccount.tenant_id.value,
                client_id: mailAccount.client_id.value,
                client_secret: mailAccount.client_secret.value,
                code: mailAccount.code.value,
                refresh_token: mailAccount.refresh_token.value,
                mails_download_limit: mailAccount.mails_download_limit.value,
                login_endpoint: mailAccount.login_endpoint.value,
                graph_scope: mailAccount.graph_scope.value,
                start_syncing_from: mailAccount.start_syncing_from.value,
                last_synchronization: mailAccount.last_synchronization.value,
                folders: JSON.stringify(mailAccount.folders.value),
                access_token: mailAccount.access_token.value,
                email_account: mailAccount.email_account.value,
                vault: mailAccount.vault.value,
                vault_data: JSON.stringify(mailAccount.vault_data.value),
                channel_hub_error: JSON.stringify(mailAccount.channel_hub_error.value),
                is_active: mailAccount.is_active.value,
                created_at: mailAccount.created_at.value,
                updated_at: mailAccount.updated_at.value,
                created_by: mailAccount.created_by.value,
                updated_by: mailAccount.updated_by.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `MailAccount` instance by its ID.
     *
     * @param {Object} id - The ID of the `MailAccount` instance to find.
     * @returns {Promise<MailAccount|null>} The found `MailAccount` instance or `null` if not found.
     */
    async find(id) {
        try {
            const result = await this.read
                .table('mail_accounts')
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first('*');

            return !result ? null : new MailAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `MailAccount` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<MailAccount[]>} A promise that resolves to an array of `MailAccount` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('mail_accounts').select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows.map((row) => new MailAccount(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.read.table('mail_accounts').count('* as count');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows[0].count;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('count');
        }
    }

    async findIdByEmailAccount(emailAccount) {
        try {
            const result = await this.table()
                .where({ email_account: emailAccount.value })
                .whereNull('deleted_at')
                .first();
            return !result ? null : new MailAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findIdByEmailAccount');
        }
    }

    async findAllByEmailAccounts(emailAddresses) {
        try {
            const normalized = [...new Set((emailAddresses ?? []).filter(Boolean).map((email) => email.toLowerCase()))];

            if (normalized.length === 0) {
                return [];
            }

            const rows = await this.table()
                .whereNull('deleted_at')
                .whereIn(this.connection.raw('lower(email_account)'), normalized);

            return rows.map((row) => new MailAccount(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findAllByEmailAccounts');
        }
    }
}
