import { KnexRepository } from '../../shared/index.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export default class KnexClassificationsLevelDistinctionRepository extends KnexRepository {
    constructor(knexConfig, readerConfig = null) {
        super(knexConfig, 'clasificaciones', readerConfig);
    }

    async find(level) {
        try {
            const validPattern = /^[a-zA-Z0-9_]+$/;
            if (!validPattern.test(level)) {
                throw new Error(
                    `Invalid level parameter: ${level}. Only alphanumeric characters and underscores are allowed`
                );
            }
            return await this.read.table().where('deleted_at', null).distinct(`${level} as level`);
        } catch (error) {
            Helper.logError('Error finding classification level distinct:', error);
            throw new QueryDBError('find');
        }
    }
}
