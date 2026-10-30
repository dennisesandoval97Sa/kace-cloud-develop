import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexCaseCounterStatesRepository extends KnexRepository {
    constructor(config) {
        super(config, 'cases');
    }
    async getCountsWithReferences({ field = '', value = '' }) {
        try {
            const estados = await this.table('estados').select('id', 'nombre', 'icon_class').whereNull('deleted_by');

            const countCasosQuery = this.table('transiciones')
                .leftJoin(this.qualifiedName('cases'), 'transiciones.id', 'cases.transicion_id')
                .select('transiciones.estado_actual_id', 'transiciones.estado_actual_id')
                .count('cases.id as count')
                .whereIn(
                    'transiciones.estado_actual_id',
                    estados.map((e) => e.id)
                )
                .andWhere(`casos.${field}`, value);

            countCasosQuery.groupBy('transiciones.estado_actual_id');

            const countCasos = await countCasosQuery;

            const countCasosMap = countCasos.reduce((map, caso) => {
                map[caso.estado_actual_id] = caso.count;
                return map;
            }, {});

            const dataFormatted = estados.map((estado) => ({
                id: estado.id,
                nombre: estado.nombre,
                icon_class: estado.icon_class,
                count: Number(countCasosMap[estado.id]) || 0,
            }));

            return dataFormatted;
        } catch (error) {
            Helper.logInfo('Error counting cases', error);
            throw new QueryDBError('count');
        }
    }
}
