import { Helper, KnexRepository } from '../../shared/index.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export class KnexClassificationsLevelDistinctionRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'cases', readerConfig);
    }

    async find() {
        try {
            return await this.read
                .table('cases')
                .join(this.qualifiedName('transiciones'), 'cases.transicion_id', 'transiciones.id')
                .join(this.qualifiedName('estados'), (builder) => {
                    builder.on(
                        'estados.id',
                        '=',
                        this.connection.raw('COALESCE(transiciones.estado_actual_id, transiciones.siguiente_estado_id)')
                    );
                })
                .select('estados.nombre as estado', 'estados.id')
                .count('cases.id as total')
                .groupBy('estados.nombre', 'estados.id');
        } catch (error) {
            Helper.logError('Error counting cases by state:', error);
            throw new QueryDBError('find');
        }
    }
}
