import knexLib from 'knex';
import {
    EntityCandidateFinder,
    NO_PREFILTER,
} from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import {
    createCasesFieldCatalog,
    createUsersFieldCatalog,
} from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

const action = (conditions) => ({ id: { value: 'a1' }, conditions: { value: conditions }, entity: { value: 'case' } });

describe('SQL prefilter schema qualification', () => {
    let pg;
    beforeAll(() => {
        // pg client builds SQL strings without opening a connection (.toString()).
        pg = knexLib({ client: 'pg' });
    });
    afterAll(async () => {
        await pg.destroy();
    });

    it('qualifies FROM and JOIN tables with the tenant schema, leaving column refs and ON-clauses bare', () => {
        const qualify = (table) => `tenant_x.${table}`;
        const base = pg(qualify('cases')).select('cases.id').whereNull('cases.fecha_resolucion');
        const translator = new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog() });

        const applied = translator.applyToQuery(
            base,
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.estadoActual', value: 's1', operator: '=', value_type: 'text' }],
            }),
            { baseTable: 'cases', qualify }
        );

        const sql = applied.toString();

        // Physical table names (FROM + JOIN targets) must be schema-qualified.
        expect(sql).toContain('"tenant_x"."cases"');
        expect(sql).toContain('"tenant_x"."transiciones"');
        expect(sql).toContain('"tenant_x"."estados"');

        // Column references and ON-clauses use the bare relation alias (no schema).
        expect(sql).toContain('"cases"."transicion_id" = "transiciones"."id"');
        expect(sql).toContain('"transiciones"."siguiente_estado_id" = "estados"."id"');
    });

    it('qualifies the FROM table for a join-less domain (usuarios)', () => {
        const qualify = (table) => `tenant_x.${table}`;
        const base = pg(qualify('usuarios')).select('usuarios.id').where('is_active', '1').whereNull('deleted_at');
        const translator = new ActionConditionsToSqlTranslator({ catalog: createUsersFieldCatalog() });

        const applied = translator.applyToQuery(
            base,
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'usuarios.external_id', value: 'x1', operator: '=', value_type: 'text' }],
            }),
            { baseTable: 'usuarios', qualify }
        );

        const sql = applied.toString();
        expect(sql).toContain('from "tenant_x"."usuarios"');
        // No joins for the users catalog; FROM must never be double-qualified.
        expect(sql).not.toContain('"tenant_x"."tenant_x"');
        // Column refs stay bare (QueryTranslator emits them via whereRaw, unquoted).
        expect(sql).toContain('usuarios.external_id = ');
    });

    it('EntityCandidateFinder derives qualify from the repository schema and passes it to buildBaseQuery and translator', async () => {
        const seen = {};
        const fakeConn = (table) => {
            seen.fromTable = table;
            return { select: () => ({ whereNull: () => ({}) }) };
        };

        const finder = new EntityCandidateFinder({
            entityRepository: { connection: fakeConn, tableName: 'cases', schema: 'tenant_x' },
            translator: {
                applyToQuery: (_query, _action, opts) => {
                    seen.opts = opts;
                    return null;
                },
            },
            buildBaseQuery: (conn, t, qualify) => conn(qualify(t)).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });

        const result = await finder.find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );

        expect(result).toBe(NO_PREFILTER);
        expect(seen.fromTable).toBe('tenant_x.cases');
        expect(typeof seen.opts.qualify).toBe('function');
        expect(seen.opts.qualify('estados')).toBe('tenant_x.estados');
        expect(seen.opts.baseTable).toBe('cases');
    });

    it('falls back to identity qualification when the repository has no schema', async () => {
        const seen = {};
        const fakeConn = (table) => {
            seen.fromTable = table;
            return { select: () => ({ whereNull: () => ({}) }) };
        };

        const finder = new EntityCandidateFinder({
            entityRepository: { connection: fakeConn, tableName: 'cases' },
            translator: {
                applyToQuery: (_query, _action, opts) => {
                    seen.opts = opts;
                    return null;
                },
            },
            buildBaseQuery: (conn, t, qualify) => conn(qualify(t)).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });

        await finder.find(
            action({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'cases.responsable_id', value: 'r1', operator: '=', value_type: 'text' }],
            })
        );

        expect(seen.fromTable).toBe('cases');
        expect(seen.opts.qualify('estados')).toBe('estados');
    });
});
