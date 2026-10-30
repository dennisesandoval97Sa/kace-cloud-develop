import { Helper, InvalidArgumentError, QueryDBError, ValidationFailError } from '@kace/core/src/shared';
import { Email } from '../../domain/Email';
import { KnexRepository } from '../../../shared/index.js';
import { isUniqueViolation } from './EmailPersistenceErrors.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexEmailsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'emails', readerConfig);
    }

    /**
     * Save an instance of emails in the database.
     * @param {Email} email
     * @returns {Promise<void>}
     */
    async save(email, trx = null) {
        try {
            DbRequestContext.markWrite();
            const table = trx ? this.trxTable(trx) : this.table();
            await table.insert({
                id: email.id.value,
                s3_key: email.s3_key.value,
                subject: email.subject.value,
                sender: email.sender.value,
                to: JSON.stringify(email.to.value),
                cc: JSON.stringify(email.cc.value),
                bcc: JSON.stringify(email.bcc.value),
                priority: email.priority.value,
                workspace_id: email.workspace_id.value,
                message_id: email.message_id.value,
                thread_id: email.thread_id.value,
                account_id: email.account_id.value,
                received_at: email.received_at.value,
                case_id_outbound: email.case_id_outbound.value,
                case_reference_outbound: email.case_reference_outbound.value,
                is_outbound: email.is_outbound.value,

                created_at: email.created_at.value,
                created_by: email.created_by.value,
                updated_at: email.updated_at.value,
                updated_by: email.updated_by.value,
                deleted_at: email.deleted_at.value,
                deleted_by: email.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving emails', error);
            if (isUniqueViolation(error)) {
                throw new ValidationFailError(`Email with id ${email.id.value} already exists`, 'id');
            }
            throw new QueryDBError('save');
        }
    }

    /**
     * Searches for email instances according to the given criteria.
     * @param {Object} criteria
     * @returns {Promise<Email[]>}
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table(this.tableName).distinct(`${this.tableName}.*`));
            query.whereNull(`${this.tableName}.deleted_at`);
            Helper.logDebug('query:', query.toString());

            const rows = await query;

            return rows.map((row) => Email.create(row));
        } catch (error) {
            Helper.logError('Error searching email', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Finds an `emails` instance by its ID.
     * @param {ValueObjectUuid} id - The ID of the `emails` to find.
     * @returns {Promise<Email|null>} A promise that resolves to the `emails` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `emails`.
     */
    async find(id) {
        try {
            const idValue = typeof id === 'string' ? id : id?.value;

            if (!idValue) {
                throw new InvalidArgumentError('ID is required');
            }

            const result = await this.read.table('emails').where({ id: idValue }).first();
            return result ? new Email(result) : null;
        } catch (error) {
            Helper.logError('Error finding email', error);
            throw new QueryDBError('find');
        }
    }

    async findByWorkspaceAndMessageId(workspaceId, messageId) {
        try {
            const workspaceIdValue = typeof workspaceId === 'string' ? workspaceId : workspaceId?.value;

            if (!workspaceIdValue || !messageId) {
                throw new InvalidArgumentError('Workspace ID and message ID are required');
            }

            const row = await this.table()
                .where({
                    workspace_id: workspaceIdValue,
                    message_id: messageId,
                })
                .first();

            return row ? new Email(row) : null;
        } catch (error) {
            Helper.logError('Error finding email by workspace and message ID', error);
            throw new QueryDBError('findByWorkspaceAndMessageId');
        }
    }

    async update(email) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    id: email.id.value,
                    s3_key: email.s3_key.value,
                    subject: email.subject.value,
                    sender: email.sender.value,
                    to: JSON.stringify(email.to.value),
                    cc: JSON.stringify(email.cc.value),
                    bcc: JSON.stringify(email.bcc.value),
                    priority: email.priority.value,
                    workspace_id: email.workspace_id.value,
                    message_id: email.message_id.value,
                    thread_id: email.thread_id.value,
                    account_id: email.account_id.value,
                    received_at: email.received_at.value,
                    case_id_outbound: email.case_id_outbound.value,
                    case_reference_outbound: email.case_reference_outbound.value,
                    is_outbound: email.is_outbound.value,

                    created_at: email.created_at.value,
                    created_by: email.created_by.value,
                    updated_at: email.updated_at.value,
                    updated_by: email.updated_by.value,
                    deleted_at: email.deleted_at.value,
                    deleted_by: email.deleted_by.value,
                })
                .where({ id: email.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating emails', error);
            throw new QueryDBError('update');
        }
    }

    /*** Counts the number of `emails ` instances that match the given criteria.
     * @param { Object } criteria - The criteria for the count operation.
     * @returns { Promise < number >} A promise that resolves to the count of matching `Emails` instances.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(
                this.read.table(this.tableName).countDistinct({ count: `${this.tableName}.id` })
            );
            query.whereNull(`${this.tableName}.deleted_at`);
            query.clearOrder();
            const [row] = await query;
            return row;
        } catch (error) {
            Helper.logError('Error counting email', error);
            throw new QueryDBError('count');
        }
    }
}
