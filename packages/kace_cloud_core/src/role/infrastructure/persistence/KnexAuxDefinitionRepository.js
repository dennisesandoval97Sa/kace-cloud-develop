import { Helper, KnexRepository, QueryDBError } from '../../../shared';

/**
 * Class in `roles` to check if an aux_definition exists by name.
 */
export class KnexAuxDefinitionRepository extends KnexRepository {
    constructor(config) {
        super(config, 'aux_definitions');
    }

    async existsByName(name) {
        try {
            const result = await this.table().where({ name }).first();
            return !!result;
        } catch (error) {
            Helper.logError(`Error checking existence of aux_definition by name "${name}": ${error.message}`);
            throw new QueryDBError('existsByName');
        }
    }

    async existsByTableName(moduleId) {
        try {
            const result = await this.table()
                .where({ tablename: `aux_${moduleId}` })
                .first('id');
            return !!result;
        } catch (error) {
            Helper.logError(
                `Error checking existence of aux_definition by tablename "${this.tableName}": ${error.message}`
            );
            throw new QueryDBError('existsByName');
        }
    }
}
