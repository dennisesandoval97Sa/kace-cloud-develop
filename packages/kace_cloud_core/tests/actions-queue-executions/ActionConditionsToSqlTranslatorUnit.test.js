import dayjs from 'dayjs';
import { knexConfig } from '../knexfile.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

const action = (conditions) => ({
    id: { value: 'action-1' },
    conditions: { value: conditions },
    entity: { value: 'case' },
});

// `cases` exists in the real migrated schema (see tests/knexfile.js — every test file gets
// its own cloned postgres database), so the translator is exercised against the real query
// builder. applyToQuery() never executes the query (only .toSQL() is inspected), so no seed
// data is needed.
describe('ActionConditionsToSqlTranslator', () => {
    const knex = knexConfig;

    it('returns the same knexQuery with WHERE applied when subset exists', () => {
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
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'abc', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).not.toBeNull();
        expect(result.toSQL().bindings).toContain('abc');
    });

    it('returns null when no translatable subset exists', () => {
        const tr = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog(), evaluationNow: dayjs() });
        const q = knex('cases').select('id');
        const result = tr.applyToQuery(
            q,
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'unknown.foo', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBeNull();
    });

    it('ANDs the fecha_resolucion prefilter with a top-level OR condition group instead of leaking the OR', () => {
        const tr = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog(), evaluationNow: dayjs() });
        const q = knex('cases').select('id').whereNull('fecha_resolucion');
        const result = tr.applyToQuery(
            q,
            action({
                id: 'c',
                combinator: 'or',
                rules: [
                    { id: 'r1', field: 'cases.responsable_id', value: 'abc', operator: '=', value_type: 'text' },
                    { id: 'r2', field: 'cases.cliente_id', value: 'xyz', operator: '=', value_type: 'text' },
                ],
            })
        );
        expect(result).not.toBeNull();
        const sql = result.toSQL().sql;
        expect(sql).toContain('"fecha_resolucion" is null and (');
        expect(sql).not.toContain('"fecha_resolucion" is null or');
    });

    it('ANDs the prefilter with a top-level OR of AND-groups without leaking the OR', () => {
        const tr = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog(), evaluationNow: dayjs() });
        const q = knex('cases').select('id').whereNull('fecha_resolucion');

        const result = tr.applyToQuery(
            q,
            action({
                id: 'root_or',
                combinator: 'or',
                rules: [
                    {
                        id: 'group_sitio',
                        combinator: 'and',
                        rules: [
                            {
                                id: 'r1',
                                field: 'cases.estadoActual',
                                value: 'estado-x',
                                operator: '=',
                                value_type: 'text',
                            },
                            {
                                id: 'r2',
                                field: 'cases.clasificacion_id',
                                value: 'clasif-y',
                                operator: '=',
                                value_type: 'text',
                            },
                        ],
                    },
                    {
                        id: 'group_preventivo',
                        combinator: 'and',
                        rules: [
                            {
                                id: 'r3',
                                field: 'cases.estadoActual',
                                value: 'estado-z',
                                operator: '=',
                                value_type: 'text',
                            },
                        ],
                    },
                ],
            })
        );
        expect(result).not.toBeNull();
        const sql = result.toSQL().sql;
        expect(sql).toContain('"fecha_resolucion" is null and (');
        expect(sql).not.toContain('"fecha_resolucion" is null or');
        // Verify that it correctly grouped the first two rules together (estadoActual → resolved via JOIN as estados.id)
        expect(sql).toMatch(/and \(\(estados\.id = \? and cases\.clasificacion_id = \?\) or \(estados\.id = \?\)\)/);
        expect(result.toSQL().bindings).toEqual(['estado-x', 'clasif-y', 'estado-z']);
    });

    it('returns null when a rule only fails at SQL compile time (deferred knex callback)', () => {
        const tr = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog(), evaluationNow: dayjs() });
        const q = knex('cases').select('id').whereNull('fecha_resolucion');
        const result = tr.applyToQuery(
            q,
            action({
                id: 'c',
                combinator: 'and',
                rules: [
                    {
                        id: 'r',
                        field: 'cases.antiguedad_dias',
                        value: '10',
                        operator: 'between',
                        value_type: 'number',
                    },
                ],
            })
        );
        expect(result).toBeNull();
    });

    it('catches translator errors and returns null (degrades to NO_PREFILTER)', () => {
        const tr = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog(), evaluationNow: dayjs() });
        const badQuery = {};
        const result = tr.applyToQuery(
            badQuery,
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBeNull();
    });
});
