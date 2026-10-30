import { KnexCaseRepository } from '../../../../src/cases/infrastructure/persistence/KnexCaseRepository.js';

describe('KnexCaseRepository.findSummaryByIds schema qualification', () => {
    function createRecordingKnex({ result = [] } = {}) {
        const tables = [];
        const calls = [];
        const createBuilder = (tableName) => {
            const builder = {};
            const chain = (method) => {
                builder[method] = (...args) => {
                    calls.push([method, tableName, args]);
                    return builder;
                };
            };

            ['select', 'leftJoin', 'whereIn', 'whereNull', 'orderBy'].forEach(chain);
            builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
            builder.catch = (reject) => Promise.resolve(result).catch(reject);

            return builder;
        };
        const knex = (tableName) => {
            tables.push(tableName);
            return createBuilder(tableName);
        };
        knex.client = {
            config: { client: 'pg', schema: 'tenant_schema' },
            on: () => {},
        };
        knex.raw = (sql) => ({ sql });

        return { knex, tables, calls };
    }

    it('schema-qualifies case summary reads', async () => {
        const { knex, tables, calls } = createRecordingKnex();
        const repository = new KnexCaseRepository(knex);

        await repository.findSummaryByIds(['case-1']);

        expect(tables).toEqual(['tenant_schema.cases']);
        expect(calls).toContainEqual([
            'leftJoin',
            'tenant_schema.cases',
            ['tenant_schema.clasificaciones', 'cases.clasificacion_id', 'clasificaciones.id'],
        ]);
        expect(calls).toContainEqual([
            'leftJoin',
            'tenant_schema.cases',
            ['tenant_schema.transiciones', 'cases.transicion_id', 'transiciones.id'],
        ]);
        expect(calls).toContainEqual([
            'leftJoin',
            'tenant_schema.cases',
            ['tenant_schema.estados', 'estados.id', 'transiciones.siguiente_estado_id'],
        ]);
        expect(calls).toContainEqual([
            'leftJoin',
            'tenant_schema.cases',
            ['tenant_schema.usuarios as responsable', 'responsable.id', 'cases.responsable_id'],
        ]);
        expect(calls).toContainEqual(['whereIn', 'tenant_schema.cases', ['cases.id', ['case-1']]]);
        expect(calls).toContainEqual(['whereNull', 'tenant_schema.cases', ['cases.deleted_by']]);
    });
});
