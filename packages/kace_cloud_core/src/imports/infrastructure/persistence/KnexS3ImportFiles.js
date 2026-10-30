import { KnexRepository, QueryDBError } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { S3ImportFile } from '../../domain/S3ImportFile.js';
import { User } from '../../../users/index.js';
import { MailAccount } from '../../../mail-accounts/domain/MailAccount.js';

export class KnexS3ImportFiles extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 's3_import_files', readerConfig);
    }

    /**
     * Register an upload S3 imports file in the database.
     * @returns {Promise<void>}
     */
    async save(file) {
        try {
            await this.table().insert({
                id: file.id.value,
                file_path: file.file_path.value,
                status: file.status.value,
                upload_attempts: file.upload_attempts.value,
                total_records: file.total_records.value,
                processed_records: file.processed_records.value,
                last_updated_at: file.last_updated_at?.value,
                created_at: file.created_at.value,
                created_by: file.created_by.value,
                error_details: file.error_details?.value,
                target_table: file.target_table.value,
                action_type: file.action_type?.value,
                should_override_array: file.should_override_array?.value ?? false,
            });
        } catch (error) {
            Helper.logError('Error saving S3 import file:', error);
            throw new QueryDBError('save');
        }
    }

    async findFileToProcess() {
        try {
            const knex = this.connection;

            const nowMinus15Minutes = knex.raw("NOW() - INTERVAL '15 minutes'");

            const result = await this.table()
                .where(function () {
                    this.whereIn('status', ['pending', 'failed']).orWhere(function () {
                        this.where('status', 'processing').andWhere('last_updated_at', '<', nowMinus15Minutes);
                    });
                })
                .orderBy('created_at', 'asc')
                .first();

            return result ? new S3ImportFile(result) : null;
        } catch (error) {
            Helper.logError('Error fetching the oldest unprocessed S3 import file:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {string} tableName
     * @param {Object} record
     */
    async saveRecord(tableName, record) {
        try {
            await this.table(tableName).insert(record);
        } catch (error) {
            Helper.logError('Error saveRecord S3 import file:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * @param {string} tableName
     * @param {string} id
     * @param {Object} data
     */
    async updateRecord(tableName, id, data) {
        try {
            await this.table(tableName).where({ id }).update(data);
        } catch (error) {
            Helper.logError('Error updateRecord S3 import file:', error);
            throw new QueryDBError('update');
        }
    }

    async saveUserGroupRelation(record) {
        try {
            await this.table('rel_usuarios_grupos').insert(record);
        } catch (error) {
            Helper.logError('Error saveUserGroupRelation S3 import file:', error);
            throw new QueryDBError('save');
        }
    }

    async findActiveRoleById(id) {
        try {
            return await this.table('roles').select(['id']).where({ id }).whereNull('deleted_at').first();
        } catch (error) {
            Helper.logError('Error fetching active Role by Id.', error);
            throw new QueryDBError('find');
        }
    }

    async findActiveGroupsByIds(ids) {
        try {
            if (!ids || ids.length === 0) return [];
            return await this.table('grupos').select(['id']).whereIn('id', ids).whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error fetching active Group by Id.', error);
            throw new QueryDBError('find');
        }
    }

    async replaceUserGroupRelations(usuario_id, groupIds = []) {
        try {
            const desired = Array.from(new Set(groupIds)).filter(Boolean);
            const qualifiedTable = this.qualifiedName('rel_usuarios_grupos');
            await this.connection.transaction(async (trx) => {
                await trx(qualifiedTable).where({ usuario_id }).del();
                if (desired.length > 0) {
                    const rows = desired.map((grupo_id) => ({ usuario_id, grupo_id }));
                    await trx(qualifiedTable).insert(rows);
                }
            });
        } catch (error) {
            Helper.logError('Error replacing user-group relations.', error);
            throw new QueryDBError('save');
        }
    }

    async updateImport(id, updateData) {
        try {
            if (!id || !updateData) {
                throw new Error('ID and updateData are required');
            }

            const result = await this.table().where({ id: id }).update(updateData).returning('*');

            return result.length > 0 ? new S3ImportFile(result[0]) : null;
        } catch (error) {
            Helper.logError('Error updating S3 import file status:', error);
            throw new QueryDBError('update');
        }
    }

    async findImportsByUser(id) {
        try {
            const result = await this.read.table('s3_import_files').where({ created_by: id });
            return result?.length ? result.map((row) => new S3ImportFile(row)) : [];
        } catch (error) {
            Helper.logError('Error finding S3ImportFile by user:', error);
            throw new QueryDBError('find');
        }
    }

    async findUserToNotify(createdById) {
        try {
            const result = await this.table('usuarios').where({ id: createdById }).first();

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logError('Error finding user to notify S3ImportFile', error);
            throw new QueryDBError('find');
        }
    }

    async getNotificationsConfig(userId) {
        try {
            const config = await this.table('usuarios as u')
                .join(`${this.qualifiedName('grupos')} as g`, 'u.grupo_activo', 'g.id')
                .join(`${this.qualifiedName('global_configurations')} as gc`, 'g.configuration_id', 'gc.id')
                .select('gc.*')
                .where('u.id', userId)
                .first();

            if (!config) return null;

            if (typeof config.settings === 'string') {
                try {
                    config.settings = JSON.parse(config.settings);
                } catch (err) {
                    Helper.logError('Invalid JSON in config.settings', err);
                    return null;
                }
            }

            const mailAccId = config.settings?.behaviors?.application?.agente?.casos?.account_to_send_notifications;
            if (!mailAccId) return null;

            const mailAccount = await this.table('mail_accounts').where({ id: mailAccId }).first();
            if (!mailAccount) return null;

            const secretIds = [];
            if (mailAccount.username) secretIds.push(mailAccount.username);
            if (mailAccount.password) secretIds.push(mailAccount.password);

            let secretsMap = {};
            if (secretIds.length) {
                const secrets = await this.table('boveda_secretos').whereIn('id', secretIds).select('id', 'secreto');

                secretsMap = secrets.reduce((acc, row) => {
                    acc[row.id] = row.secreto;
                    return acc;
                }, {});
            }

            mailAccount.username = secretsMap[mailAccount.username] || mailAccount.username;
            mailAccount.password = secretsMap[mailAccount.password] || mailAccount.password;

            return new MailAccount(mailAccount);
        } catch (error) {
            Helper.logError('Error in getNotificationsConfig()', error);
            return null;
        }
    }

    async search(criteria) {
        try {
            const queryBuilder = this.read.table('s3_import_files').select('*');
            criteria.convertToKnex(queryBuilder);
            const rows = await queryBuilder;
            return rows.map((row) => new S3ImportFile(row));
        } catch (error) {
            Helper.logError('Error in KnexS3ImportFiles.search():', error);
            throw new QueryDBError('search');
        }
    }
}
