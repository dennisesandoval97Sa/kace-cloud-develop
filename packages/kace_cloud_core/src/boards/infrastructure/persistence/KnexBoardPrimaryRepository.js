import { KnexRepository } from '@kace/core/src/shared';

export class KnexBoardPrimaryRepository extends KnexRepository {
    constructor(config) {
        super(config);
    }

    buildQuery({ primary_entity, relations = [], columns = [], filters = [], groupBy = [], having = [] }) {
        if (!primary_entity || !columns?.length) {
            throw new Error('primary_entity y columnas son requeridos');
        }

        const selectColumns = columns.map((c) => `${primary_entity}.${c.expression} as "${c.alias}"`);

        let query = this.table(primary_entity).distinct(selectColumns);

        relations.forEach((relation) => {
            const joinType = (relation.join_type || 'INNER').toLowerCase();
            query = query[joinType + 'Join'](relation.related_entity, function () {
                relation.on.forEach((cond) => this.on(cond.left, cond.op, cond.right));
            });
        });

        // Filtros WHERE
        filters.forEach((f) => {
            if (f.operator.toLowerCase() === 'in') query.whereIn(f.column, f.value);
            else if (f.operator.toLowerCase() === 'not in') query.whereNotIn(f.column, f.value);
            else query.where(f.column, f.operator, f.value);
        });

        // GROUP BY
        if (groupBy?.length) query.groupBy(groupBy);

        // HAVING
        having.forEach((h) => query.having(h.column, h.operator, h.value));

        return query;
    }

    async fetchPaginated(params, page = 1, pageSize = 25) {
        const offset = (page - 1) * pageSize;
        const result = await this.buildQuery(params).limit(pageSize).offset(offset);
        return result;
    }
}
