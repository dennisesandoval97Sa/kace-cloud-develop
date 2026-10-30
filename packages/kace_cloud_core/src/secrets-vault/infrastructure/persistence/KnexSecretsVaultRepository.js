import { SecretsVault } from '../../domain/SecretsVault.js';
import { Helper, KnexRepository } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexSecretsVaultRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'boveda_secretos', readerConfig);
    }
    /**
     *
     * @param {SecretsVault} dto secret instance with data for insert
     * @returns {Promise<void>}
     */
    async save(dto) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: dto.id.value,
                descripcion: dto.descripcion.value,
                referencia: dto.referencia.value,
                secreto: dto.secreto.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
                password_encryption_migrated: dto.password_encryption_migrated.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id identificator for secret to get
     * @returns {Promise<SecretsVault|null>}
     */
    async find(id) {
        try {
            const result = await this.read
                .table(this.tableName)
                .select('*')
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first();
            return !result ? null : new SecretsVault(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {Criteria} criteria Object with criteria to search
     * @returns {Promise<SecretsVault[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new SecretsVault(row));
        } catch (error) {
            Helper.logError('Error searching secrets vault', error);
            throw new QueryDBError('search');
        }
    }

    /**
     *
     * @param {ValueObjectReference} reference reference for search secret
     * @returns {Promise<SecretsVault|null>}
     */
    async findByReference(reference) {
        try {
            const secretsVault = await this.read
                .table(this.tableName)
                .select('*')
                .where({ referencia: reference.value })
                .first();

            return secretsVault ? new SecretsVault(secretsVault) : null;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    /**
     * @param {ValueObjectReference[]} references
     * @returns {Promise<SecretsVault[]>}  only secrets that exist; missing refs are absent
     */
    async findByReferences(references) {
        if (!references.length) return [];
        try {
            const refValues = references.map((r) => r.value);
            const rows = await this.read.table(this.tableName).select('*').whereIn('referencia', refValues);
            return rows.map((row) => new SecretsVault(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByReferences');
        }
    }

    async findMissingReferences(references = []) {
        if (!references.length) return [];

        try {
            const existing = await this.read
                .table(this.tableName)
                .select('referencia')
                .whereIn('referencia', references);

            const existingRefs = existing.map((r) => r.referencia);

            return references.filter((ref) => !existingRefs.includes(ref));
        } catch (error) {
            Helper.logError('Error finding missing secret references:', error);
            throw new QueryDBError('findMissingReferences', error.message);
        }
    }
}
