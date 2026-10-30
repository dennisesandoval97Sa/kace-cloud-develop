import { Criteria } from '../../shared/index.js';

export class CaseAnsCounter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute({ field = '', value = '' }) {
        const filter =
            field && value
                ? {
                      field: field,
                      operator: 'eq',
                      value: value,
                      type: 'AND',
                  }
                : null;

        /**
         * pending: Vigentes
         * toOvercome: Intermedios
         * defeated: Vencidos
         * managed: Gestionados
         */
        const conditions = {
            pending: [
                { field: 'ans_posicion', operator: 'eq', value: '1', type: 'AND' },
                { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'AND' },
            ],
            toOvercome: [
                { field: 'ans_posicion', operator: 'eq', value: '2', type: 'AND' },
                { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'AND' },
            ],
            defeated: [
                { field: 'ans_posicion', operator: 'eq', value: '3', type: 'AND' },
                { field: 'fecha_resolucion', operator: 'null', value: 'null', type: 'AND' },
            ],
            managed: [{ field: 'fecha_resolucion', operator: 'notNull', value: 'notNull', type: 'AND' }],
        };

        const counter = {};

        const promises = [];

        for (const [, value] of Object.entries(conditions)) {
            const filtersByResponsable = filter;
            const allConditions = filtersByResponsable ? [...value, filtersByResponsable] : value;
            const tablename = this.#repository.tableName;
            const criteria = new Criteria(allConditions, null, null, null, null, tablename);
            const countPromise = this.#repository.count(criteria);
            promises.push(countPromise);
        }

        const results = await Promise.all(promises);

        results.forEach((result, index) => {
            const key = Object.keys(conditions)[index];
            counter[key] = Number(result.count);
        });

        return counter;
    }
}
