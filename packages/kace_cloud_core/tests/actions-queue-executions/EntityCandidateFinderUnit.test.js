import dayjs from 'dayjs';
import { knexConfig } from '../knexfile.js';
import {
    EntityCandidateFinder,
    NO_PREFILTER,
} from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

const action = (conditions) => ({ id: { value: 'a1' }, conditions: { value: conditions }, entity: { value: 'case' } });

// `cases` exists in the real migrated schema (see tests/knexfile.js — every test file gets
// its own cloned postgres database).
describe('EntityCandidateFinder (cases)', () => {
    const knex = knexConfig;
    beforeEach(async () => {
        await knex('cases').delete();
        // cases.responsable_id is FK-constrained to usuarios(id); seed the ids this file uses.
        await knex('usuarios').whereIn('id', ['r1', 'r2']).delete();
        await knex('usuarios').insert([{ id: 'r1' }, { id: 'r2' }]);
    });

    const makeFinder = () =>
        new EntityCandidateFinder({
            entityRepository: { connection: knex, tableName: 'cases' },
            translator: new ActionConditionsToSqlTranslator({
                catalog: createCasesFieldCatalog(),
                evaluationNow: dayjs(),
            }),
            buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });

    it('returns Set of case ids matching SQL subset', async () => {
        await knex('cases').insert([
            { id: '11111111-1111-1111-1111-111111111111', responsable_id: 'r1', fecha_resolucion: null },
            { id: '22222222-2222-2222-2222-222222222222', responsable_id: 'r2', fecha_resolucion: null },
        ]);
        const result = await makeFinder().find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBeInstanceOf(Set);
        expect([...result]).toEqual(['11111111-1111-1111-1111-111111111111']);
    });

    it('excludes closed cases (fecha_resolucion IS NOT NULL)', async () => {
        await knex('cases').insert([
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', responsable_id: 'r1', fecha_resolucion: '2026-01-01' },
            { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', responsable_id: 'r1', fecha_resolucion: null },
        ]);
        const result = await makeFinder().find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );
        expect([...result]).toEqual(['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']);
    });

    it('returns NO_PREFILTER sentinel when subset is null', async () => {
        const result = await makeFinder().find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'unknown.foo', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBe(NO_PREFILTER);
    });

    it('returns NO_PREFILTER when query execution throws', async () => {
        const brokenKnex = new Proxy(
            {},
            {
                get: () => () => {
                    throw new Error('boom');
                },
            }
        );
        const finder = new EntityCandidateFinder({
            entityRepository: { connection: brokenKnex, tableName: 'cases' },
            translator: new ActionConditionsToSqlTranslator({
                catalog: createCasesFieldCatalog(),
                evaluationNow: dayjs(),
            }),
            buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });
        const result = await finder.find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBe(NO_PREFILTER);
    });

    it('count returns the number of matching cases without materializing rows', async () => {
        await knex('cases').insert([
            { id: '11111111-1111-1111-1111-111111111111', responsable_id: 'r1', fecha_resolucion: null },
            { id: '22222222-2222-2222-2222-222222222222', responsable_id: 'r1', fecha_resolucion: null },
            { id: '33333333-3333-3333-3333-333333333333', responsable_id: 'r2', fecha_resolucion: null },
        ]);
        const n = await makeFinder().count(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );
        expect(n).toBe(2);
    });

    it('count excludes closed cases (fecha_resolucion IS NOT NULL)', async () => {
        await knex('cases').insert([
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', responsable_id: 'r1', fecha_resolucion: '2026-01-01' },
            { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', responsable_id: 'r1', fecha_resolucion: null },
        ]);
        const n = await makeFinder().count(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );
        expect(n).toBe(1);
    });

    it('count returns NO_PREFILTER when subset is null', async () => {
        const n = await makeFinder().count(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'unknown.foo', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(n).toBe(NO_PREFILTER);
    });

    it('count returns NO_PREFILTER when query execution throws', async () => {
        const brokenKnex = new Proxy(
            {},
            {
                get: () => () => {
                    throw new Error('boom');
                },
            }
        );
        const finder = new EntityCandidateFinder({
            entityRepository: { connection: brokenKnex, tableName: 'cases' },
            translator: new ActionConditionsToSqlTranslator({
                catalog: createCasesFieldCatalog(),
                evaluationNow: dayjs(),
            }),
            buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });
        const result = await finder.count(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'x', operator: '=', value_type: 'text' }],
            })
        );
        expect(result).toBe(NO_PREFILTER);
    });

    it('count returns 0 when no case matches', async () => {
        const n = await makeFinder().count(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'nobody', operator: '=', value_type: 'text' }],
            })
        );
        expect(n).toBe(0);
    });
});
