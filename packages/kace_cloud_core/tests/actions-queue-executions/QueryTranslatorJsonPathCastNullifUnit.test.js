import knexLib from 'knex';
import dayjs from 'dayjs';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

// Regression: a present-but-empty ("") JSON value cast to ::timestamptz / ::numeric
// makes PostgreSQL abort the whole prefilter query with
//   invalid input syntax for type timestamp with time zone: ""
// which forces EntityCandidateFinder to degrade to NO_PREFILTER (full in-memory scan).
// Wrapping the JSON extraction in NULLIF(<expr>, '') turns "" into NULL so the
// comparison is simply false instead of erroring.
describe('QueryTranslator jsonPath cast guards empty strings with NULLIF', () => {
    let knex;
    beforeAll(() => {
        knex = knexLib({ client: 'pg' });
    });
    afterAll(async () => {
        await knex.destroy();
    });

    const action = (conditions) => ({
        id: { value: 'action-1' },
        conditions: { value: conditions },
        entity: { value: 'case' },
    });

    const sqlFor = (field, valueType, value, operator) => {
        const tr = new ActionConditionsToSqlTranslator({
            catalog: createCasesFieldCatalog(),
            evaluationNow: dayjs('2026-05-13T10:00:00Z'),
        });
        const q = knex('cases').select('id');
        const result = tr.applyToQuery(
            q,
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field, value, operator, value_type: valueType }],
            })
        );
        expect(result).not.toBeNull();
        return result.toSQL().sql.toLowerCase();
    };

    it("wraps a date jsonPath cast with NULLIF(expr, '') before ::timestamptz", () => {
        const sql = sqlFor('aux_cases.tarea_preventiva.fecha_hora_vencimiento', 'date', '2026-01-01T00:00:00Z', '<');
        expect(sql).toContain('::timestamptz');
        expect(sql).toContain('nullif(');
        expect(sql).toContain("'')::timestamptz");
    });

    it("wraps a number jsonPath cast with NULLIF(expr, '') before ::numeric", () => {
        const sql = sqlFor('aux_cases.info_parent_case.monto', 'number', '100', '>');
        expect(sql).toContain('::numeric');
        expect(sql).toContain('nullif(');
        expect(sql).toContain("'')::numeric");
    });
});
